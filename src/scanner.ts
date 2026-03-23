import fs from 'node:fs/promises';
import path from 'node:path';
import { SUPPORTED_EXTENSIONS } from './config.js';
import { insertImage } from './db.js';
import type { ScanResult } from './types.js';

export async function scanDirectory(inputDir: string): Promise<ScanResult> {
  const result: ScanResult = { total: 0, newImages: 0, skipped: 0 };
  await walk(inputDir, inputDir, result);
  return result;
}

async function walk(baseDir: string, currentDir: string, result: ScanResult): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walk(baseDir, fullPath, result);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

    result.total++;

    const relativePath = path.relative(baseDir, fullPath);
    const relativeDir = path.dirname(relativePath);
    const stats = await fs.stat(fullPath);

    const inserted = insertImage({
      original_path: relativePath,
      relative_dir: relativeDir === '.' ? '' : relativeDir,
      original_name: entry.name,
      extension: ext,
      file_size: stats.size,
      is_svg: ext === '.svg' ? 1 : 0,
    });

    if (inserted) {
      result.newImages++;
    } else {
      result.skipped++;
    }
  }
}
