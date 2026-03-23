import cliProgress from 'cli-progress';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getConvertedImages, getStatusCounts, getAllImages } from './db.js';
import type { ScanResult, TokenUsage, PipelineLogger } from './types.js';

let bar: cliProgress.SingleBar | null = null;
let errorCount = 0;

export function logScanComplete(result: ScanResult): void {
  console.log(`\nScan complete: ${result.total} images found (${result.newImages} new, ${result.skipped} already in DB)`);
}

export function initProgressBar(label: string, total: number): void {
  errorCount = 0;
  bar = new cliProgress.SingleBar({
    format: `${label} |{bar}| {value}/{total} | {percentage}% | Errors: {errors}`,
    barCompleteChar: '=',
    barIncompleteChar: ' ',
    hideCursor: true,
  });
  bar.start(total, 0, { errors: 0 });
}

export function tick(): void {
  bar?.increment(1, { errors: errorCount });
}

export function tickError(): void {
  errorCount++;
  bar?.increment(1, { errors: errorCount });
}

export function stopProgressBar(): void {
  bar?.stop();
  bar = null;
}

export function printDryRunPreview(): void {
  const images = getAllImages();
  const analyzed = images.filter(img => img.new_stem);

  if (analyzed.length === 0) {
    console.log('\nNo images analyzed yet.');
    return;
  }

  console.log('\n--- Dry Run Preview ---\n');
  console.log('Original → New Name\n');

  for (const img of analyzed) {
    console.log(`  ${img.original_path}`);
    console.log(`  → ${img.output_path}\n`);
  }

  console.log(`Total: ${analyzed.length} images would be renamed/converted.`);

  const errors = images.filter(img => img.status === 'error');
  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const img of errors) {
      console.log(`  ${img.original_path}: ${img.error_message}`);
    }
  }
}

export async function generateMappingJson(outputDir: string): Promise<string> {
  const converted = getConvertedImages();
  const mapping: Record<string, string> = {};

  for (const img of converted) {
    if (img.output_path) {
      mapping[img.original_path] = img.output_path;
    }
  }

  const mappingPath = path.join(outputDir, 'mapping.json');
  await fs.writeFile(mappingPath, JSON.stringify(mapping, null, 2), 'utf-8');
  return mappingPath;
}

// Pricing per million tokens (USD) — source: ai.google.dev/gemini-api/docs/pricing
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash-lite': { input: 0.00, output: 0.00 },   // free tier
  'gemini-2.5-flash':      { input: 0.15, output: 0.60 },
  'gemini-2.5-pro':        { input: 1.25, output: 10.00 },
  'gemini-2.0-flash':      { input: 0.10, output: 0.40 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
};

export function printTokenUsage(usage: TokenUsage, model: string): void {
  const totalTokens = usage.inputTokens + usage.outputTokens;

  console.log(`\n--- Token Usage ---\n`);
  console.log(`  Requests:      ${usage.requests}`);
  console.log(`  Input tokens:  ${usage.inputTokens.toLocaleString()}`);
  console.log(`  Output tokens: ${usage.outputTokens.toLocaleString()}`);
  console.log(`  Total tokens:  ${totalTokens.toLocaleString()}`);

  const pricing = MODEL_PRICING[model];
  if (pricing) {
    const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;
    console.log(`\n  Model:         ${model}`);
    console.log(`  Input cost:    $${inputCost.toFixed(4)}`);
    console.log(`  Output cost:   $${outputCost.toFixed(4)}`);
    console.log(`  Total cost:    $${totalCost.toFixed(4)}`);

    if (totalCost === 0) {
      console.log(`  (Free tier - $0.00)`);
    }
  } else {
    console.log(`\n  Model ${model} not in pricing table — check ai.google.dev/gemini-api/docs/pricing`);
  }
}

export function printSummary(): void {
  const counts = getStatusCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  console.log('\n--- Summary ---\n');
  console.log(`  Total images:  ${total}`);
  console.log(`  Converted:     ${counts['converted'] || 0}`);
  console.log(`  Errors:        ${counts['error'] || 0}`);
  console.log(`  Pending:       ${counts['pending'] || 0}`);

  if (counts['error'] && counts['error'] > 0) {
    console.log('\nFailed images:');
    const allImages = getAllImages();
    const errors = allImages.filter(img => img.status === 'error');
    for (const img of errors.slice(0, 10)) {
      console.log(`  ${img.original_path}: ${img.error_message}`);
    }
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more`);
    }
  }
}

export function createCliLogger(): PipelineLogger {
  return {
    log: (_tag, message) => console.log(message),
    initProgress: initProgressBar,
    tick,
    tickError,
    stopProgress: stopProgressBar,
  };
}
