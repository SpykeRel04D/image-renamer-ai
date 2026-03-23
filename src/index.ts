import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULTS, getGeminiApiKey, loadFileConfig } from './config.js';
import { runPipeline } from './pipeline.js';
import type { Config } from './types.js';

const program = new Command();

const fileConfig = loadFileConfig();

program
  .name('image-processor')
  .description('Rename images with SEO-friendly names using AI vision and convert to WebP')
  .option('--input <dir>', 'Source directory with images', fileConfig.input)
  .option('--output <dir>', 'Output directory for processed images', fileConfig.output)
  .option('--dry-run', 'Analyze only, preview names without converting', false)
  .option('--concurrency <n>', 'Gemini API concurrency', String(fileConfig.concurrency ?? DEFAULTS.concurrency))
  .option('--rpm <n>', 'Gemini requests per minute limit', String(fileConfig.rpm ?? DEFAULTS.rpm))
  .option('--quality <n>', 'WebP quality 1-100', String(fileConfig.quality ?? DEFAULTS.webpQuality))
  .option('--analyze-only', 'Only run analysis pass', false)
  .option('--convert-only', 'Only run conversion pass', false)
  .option('--model <model>', 'Gemini model to use', fileConfig.model ?? DEFAULTS.geminiModel)
  .option('--language <lang>', 'Language for generated names', fileConfig.language ?? DEFAULTS.language)
  .option('--context <ctx>', 'Context/domain for the images (e.g. "e-commerce", "estudio de marketing", "blog de viajes")', fileConfig.context ?? DEFAULTS.context)
  .option('--reset', 'Clear state and start fresh', false)
  .option('--verbose', 'Verbose logging', false)
  .action(async (opts) => {
    if (!opts.input || !opts.output) {
      console.error('Error: --input and --output are required (via CLI flags or config.json)');
      process.exit(1);
    }

    // Validate input directory
    const inputDir = path.resolve(opts.input);
    if (!fs.existsSync(inputDir)) {
      console.error(`Error: Input directory does not exist: ${inputDir}`);
      process.exit(1);
    }

    // Create output directory if needed
    const outputDir = path.resolve(opts.output);
    fs.mkdirSync(outputDir, { recursive: true });

    const config: Config = {
      inputDir,
      outputDir,
      dryRun: opts.dryRun,
      analyzeOnly: opts.analyzeOnly,
      convertOnly: opts.convertOnly,
      concurrency: parseInt(opts.concurrency, 10),
      rpm: parseInt(opts.rpm, 10),
      webpQuality: parseInt(opts.quality, 10),
      geminiApiKey: opts.convertOnly ? '' : getGeminiApiKey(),
      geminiModel: opts.model,
      language: opts.language,
      context: opts.context,
      verbose: opts.verbose,
      reset: opts.reset,
    };

    console.log('Image Processor - SEO Rename & WebP Conversion\n');
    console.log(`  Input:       ${config.inputDir}`);
    console.log(`  Output:      ${config.outputDir}`);
    console.log(`  Quality:     ${config.webpQuality}`);
    console.log(`  Concurrency: ${config.concurrency}`);
    console.log(`  RPM limit:   ${config.rpm}`);
    console.log(`  Model:       ${config.geminiModel}`);
    console.log(`  Language:    ${config.language}`);
    console.log(`  Context:     ${config.context}`);
    if (config.dryRun) console.log('  Mode:        DRY RUN');
    if (config.analyzeOnly) console.log('  Mode:        ANALYZE ONLY');
    if (config.convertOnly) console.log('  Mode:        CONVERT ONLY');

    try {
      await runPipeline(config);
      console.log('\nDone!');
    } catch (err) {
      console.error('\nFatal error:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse();
