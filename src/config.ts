import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

export interface FileConfig {
  input?: string;
  output?: string;
  language?: string;
  context?: string;
  model?: string;
  concurrency?: number;
  rpm?: number;
  quality?: number;
}

export function loadFileConfig(): FileConfig {
  const configPath = path.resolve('config.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    console.warn('Warning: Could not parse config.json, using defaults.');
    return {};
  }
}

export const SUPPORTED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.gif', '.svg', '.webp',
]);

export const RASTER_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.gif', '.webp',
]);

export const EXTENSION_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

export const DEFAULTS = {
  concurrency: 3,
  rpm: 15,
  webpQuality: 80,
  geminiModel: 'gemini-2.0-flash',
  language: 'español de España',
  context: 'e-commerce',
} as const;

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('Error: GEMINI_API_KEY not set. Create a .env file or set it in your environment.');
    process.exit(1);
  }
  return key;
}
