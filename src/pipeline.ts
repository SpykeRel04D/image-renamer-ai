import path from 'node:path';
import os from 'node:os';
import pLimit from 'p-limit';
import { scanDirectory } from './scanner.js';
import { analyzeImage } from './analyzer.js';
import { generateUniqueSlug } from './name-generator.js';
import { convertToWebP, convertAnimatedGifToWebP, copySvg } from './converter.js';
import { EXTENSION_TO_MIME } from './config.js';
import {
  initDb, crashRecovery, resetAll, closeDb,
  getImagesByStatus, updateImageAnalysis, updateImageConverted,
  updateImageError, updateImageStatus,
} from './db.js';
import {
  logScanComplete, initProgressBar, tick, tickError,
  stopProgressBar, printDryRunPreview, generateMappingJson, printSummary,
  printTokenUsage,
} from './reporter.js';
import { RateLimiter } from './rate-limiter.js';
import type { Config, ImageRecord, TokenUsage } from './types.js';

export async function runPipeline(config: Config): Promise<void> {
  // Initialize
  initDb(config.outputDir);

  if (config.reset) {
    resetAll();
    console.log('State cleared. Starting fresh.');
  }

  crashRecovery();

  // Phase 1: Scan
  if (!config.convertOnly) {
    console.log(`Scanning ${config.inputDir}...`);
    const scanResult = await scanDirectory(config.inputDir);
    logScanComplete(scanResult);
  }

  // Phase 2: Analyze
  if (!config.convertOnly) {
    const pending = getImagesByStatus('pending');

    const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };

    if (pending.length > 0) {
      console.log(`\nAnalyzing ${pending.length} images with Gemini (${config.rpm} RPM, concurrency ${config.concurrency})...`);
      initProgressBar('Analyzing', pending.length);

      const limiter = new RateLimiter(config.rpm);
      const semaphore = pLimit(config.concurrency);

      const tasks = pending.map(image =>
        semaphore(async () => {
          await limiter.acquire();
          try {
            updateImageStatus(image.id, 'analyzing');

            const absolutePath = path.resolve(config.inputDir, image.original_path);
            const mimeType = EXTENSION_TO_MIME[image.extension] || 'image/png';

            const result = await analyzeImage(absolutePath, mimeType, config);
            tokenUsage.inputTokens += result.inputTokens;
            tokenUsage.outputTokens += result.outputTokens;
            tokenUsage.requests++;

            const originalStem = path.parse(image.original_name).name;
            const slug = generateUniqueSlug(result.description, originalStem);
            const ext = image.is_svg ? '.svg' : '.webp';
            const newFilename = `${slug}${ext}`;
            const outputPath = image.relative_dir
              ? path.join(image.relative_dir, newFilename)
              : newFilename;

            updateImageAnalysis(image.id, {
              status: 'analyzed',
              ai_description: result.description,
              new_stem: slug,
              new_filename: newFilename,
              output_path: outputPath,
            });

            tick();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            updateImageError(image.id, msg);
            if (config.verbose) {
              console.log(`\n  Error analyzing ${image.original_path}: ${msg}`);
            }
            tickError();
          }
        })
      );

      await Promise.allSettled(tasks);
      stopProgressBar();
      printTokenUsage(tokenUsage, config.geminiModel);
    } else {
      console.log('\nNo pending images to analyze.');
    }
  }

  // Dry run: show preview and exit
  if (config.dryRun || config.analyzeOnly) {
    printDryRunPreview();
    closeDb();
    return;
  }

  // Phase 3: Convert
  if (!config.analyzeOnly) {
    const analyzed = getImagesByStatus('analyzed');

    if (analyzed.length > 0) {
      const cpuConcurrency = Math.min(os.cpus().length, 10);
      console.log(`\nConverting ${analyzed.length} images to WebP (concurrency ${cpuConcurrency})...`);
      initProgressBar('Converting', analyzed.length);

      const semaphore = pLimit(cpuConcurrency);

      const tasks = analyzed.map(image =>
        semaphore(async () => {
          try {
            updateImageStatus(image.id, 'converting');

            const absoluteInput = path.resolve(config.inputDir, image.original_path);
            const absoluteOutput = path.resolve(config.outputDir, image.output_path!);

            if (image.is_svg) {
              await copySvg(absoluteInput, absoluteOutput);
            } else if (image.extension === '.gif') {
              await convertAnimatedGifToWebP(absoluteInput, absoluteOutput, config.webpQuality);
            } else {
              await convertToWebP(absoluteInput, absoluteOutput, config.webpQuality);
            }

            updateImageConverted(image.id);
            tick();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            updateImageError(image.id, msg);
            if (config.verbose) {
              console.log(`\n  Error converting ${image.original_path}: ${msg}`);
            }
            tickError();
          }
        })
      );

      await Promise.allSettled(tasks);
      stopProgressBar();
    } else {
      console.log('\nNo analyzed images to convert.');
    }
  }

  // Phase 4: Report
  const mappingPath = await generateMappingJson(config.outputDir);
  console.log(`\nMapping saved to: ${mappingPath}`);
  printSummary();

  closeDb();
}
