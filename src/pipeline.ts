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
  updateImageError, updateImageStatus, getStatusCounts,
} from './db.js';
import {
  createCliLogger, generateMappingJson, printTokenUsage, printSummary, printDryRunPreview,
} from './reporter.js';
import { RateLimiter } from './rate-limiter.js';
import type { Config, ImageRecord, TokenUsage, PipelineLogger, PipelineResult } from './types.js';

export async function runPipeline(
  config: Config,
  options?: { logger?: PipelineLogger; signal?: AbortSignal }
): Promise<PipelineResult> {
  const logger = options?.logger ?? createCliLogger();
  const signal = options?.signal;
  const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };

  // Initialize
  initDb(config.outputDir);

  if (config.reset) {
    resetAll();
    logger.log('system', 'State cleared. Starting fresh.');
  }

  crashRecovery();

  // Phase 1: Scan
  if (!config.convertOnly) {
    logger.log('scan', `Scanning ${config.inputDir}...`);
    const scanResult = await scanDirectory(config.inputDir);
    logger.log('scan', `Scan complete: ${scanResult.total} images found (${scanResult.newImages} new, ${scanResult.skipped} already in DB)`);
  }

  // Phase 2: Analyze
  if (!config.convertOnly) {
    const pending = getImagesByStatus('pending');

    if (pending.length > 0) {
      logger.log('analyze', `Analyzing ${pending.length} images with Gemini (${config.rpm} RPM, concurrency ${config.concurrency})...`);
      logger.initProgress('Analyzing', pending.length);

      const limiter = new RateLimiter(config.rpm);
      const semaphore = pLimit(config.concurrency);

      const tasks = pending.map(image =>
        semaphore(async () => {
          if (signal?.aborted) return;
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

            logger.tick();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            updateImageError(image.id, msg);
            logger.log('error', `Error analyzing ${image.original_path}: ${msg}`);
            logger.tickError();
          }
        })
      );

      await Promise.allSettled(tasks);
      logger.stopProgress();
      printTokenUsage(tokenUsage, config.geminiModel);
    } else {
      logger.log('analyze', 'No pending images to analyze.');
    }
  }

  // Dry run: show preview and exit
  if (config.dryRun || config.analyzeOnly) {
    printDryRunPreview();
    const counts = getStatusCounts();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    closeDb();
    return {
      totalImages: total,
      converted: 0,
      errors: counts['error'] || 0,
      pending: counts['pending'] || 0,
      tokenUsage,
    };
  }

  // Abort check before convert phase
  if (signal?.aborted) {
    closeDb();
    return { totalImages: 0, converted: 0, errors: 0, pending: 0, tokenUsage };
  }

  // Phase 3: Convert
  if (!config.analyzeOnly) {
    const analyzed = getImagesByStatus('analyzed');

    if (analyzed.length > 0) {
      const cpuConcurrency = Math.min(os.cpus().length, 10);
      logger.log('convert', `Converting ${analyzed.length} images to WebP (concurrency ${cpuConcurrency})...`);
      logger.initProgress('Converting', analyzed.length);

      const semaphore = pLimit(cpuConcurrency);

      const tasks = analyzed.map(image =>
        semaphore(async () => {
          if (signal?.aborted) return;
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
            logger.tick();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            updateImageError(image.id, msg);
            logger.log('error', `Error converting ${image.original_path}: ${msg}`);
            logger.tickError();
          }
        })
      );

      await Promise.allSettled(tasks);
      logger.stopProgress();
    } else {
      logger.log('convert', 'No analyzed images to convert.');
    }
  }

  // Phase 4: Report
  const mappingPath = await generateMappingJson(config.outputDir);
  logger.log('report', `Mapping saved to: ${mappingPath}`);
  printSummary();

  const counts = getStatusCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  closeDb();

  return {
    totalImages: total,
    converted: counts['converted'] || 0,
    errors: counts['error'] || 0,
    pending: counts['pending'] || 0,
    tokenUsage,
    mappingPath,
  };
}
