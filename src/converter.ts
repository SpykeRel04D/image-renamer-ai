import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function convertToWebP(
  inputPath: string,
  outputPath: string,
  quality: number,
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(inputPath)
    .webp({ quality })
    .toFile(outputPath);
}

export async function convertAnimatedGifToWebP(
  inputPath: string,
  outputPath: string,
  quality: number,
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(inputPath, { animated: true })
    .webp({ quality, effort: 6 })
    .toFile(outputPath);
}

export async function copySvg(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.copyFile(inputPath, outputPath);
}
