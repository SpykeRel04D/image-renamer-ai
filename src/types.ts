export interface Config {
  inputDir: string;
  outputDir: string;
  dryRun: boolean;
  analyzeOnly: boolean;
  convertOnly: boolean;
  concurrency: number;
  rpm: number;
  webpQuality: number;
  geminiApiKey: string;
  geminiModel: string;
  language: string;
  context: string;
  verbose: boolean;
  reset: boolean;
}

export interface ImageRecord {
  id: number;
  original_path: string;
  relative_dir: string;
  original_name: string;
  extension: string;
  file_size: number;
  is_svg: number; // SQLite boolean: 0 or 1
  status: 'pending' | 'analyzing' | 'analyzed' | 'converting' | 'converted' | 'error';
  ai_description: string | null;
  new_stem: string | null;
  new_filename: string | null;
  output_path: string | null;
  error_message: string | null;
  analyzed_at: string | null;
  converted_at: string | null;
  created_at: string;
}

export interface ScanResult {
  total: number;
  newImages: number;
  skipped: number;
}

export interface AnalysisResult {
  description: string;
  inputTokens: number;
  outputTokens: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

export interface PipelineLogger {
  log(tag: string, message: string): void;
  initProgress(label: string, total: number): void;
  tick(): void;
  tickError(): void;
  stopProgress(): void;
}

export interface PipelineResult {
  totalImages: number;
  converted: number;
  errors: number;
  pending: number;
  tokenUsage: TokenUsage;
  mappingPath?: string;
}
