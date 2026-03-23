import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runPipeline } from '../src/pipeline.js';
import { MODEL_PRICING } from '../src/reporter.js';
import { DEFAULTS } from '../src/config.js';
import type { Config, PipelineLogger } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let abortController: AbortController | null = null;

// --- Config persistence (simple JSON file) ---
const configPath = path.join(app.getPath('userData'), 'settings.json');

function loadSavedConfig(): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveConfigToFile(config: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// --- Window ---
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#1a1a2e',
  });

  mainWindow.loadFile(path.join(__dirname, '..', '..', 'electron', 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// --- IPC Handlers ---
ipcMain.handle('select-folder', async (_event, { title }: { title: string }) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-saved-config', () => loadSavedConfig());
ipcMain.handle('save-config', (_event, config) => saveConfigToFile(config));
ipcMain.handle('open-folder', (_event, { path: folderPath }) => shell.openPath(folderPath));
ipcMain.handle('cancel-processing', () => { abortController?.abort(); });

ipcMain.handle('start-processing', async (_event, guiConfig) => {
  if (!mainWindow) return;
  const win = mainWindow;
  abortController = new AbortController();

  const config: Config = {
    inputDir: guiConfig.inputDir,
    outputDir: guiConfig.outputDir,
    geminiApiKey: guiConfig.apiKey,
    geminiModel: guiConfig.model || DEFAULTS.geminiModel,
    language: guiConfig.language || DEFAULTS.language,
    context: guiConfig.context || DEFAULTS.context,
    concurrency: guiConfig.concurrency || DEFAULTS.concurrency,
    rpm: guiConfig.rpm || DEFAULTS.rpm,
    webpQuality: guiConfig.quality || DEFAULTS.webpQuality,
    dryRun: false,
    analyzeOnly: false,
    convertOnly: false,
    verbose: false,
    reset: false,
  };

  fs.mkdirSync(config.outputDir, { recursive: true });

  const startTime = Date.now();

  // IPC Logger
  let current = 0;
  let errors = 0;
  let total = 0;
  let phase = '';

  const logger: PipelineLogger = {
    log(tag, message) {
      win.webContents.send('log-entry', { level: tag === 'error' ? 'error' : 'info', tag, message });
    },
    initProgress(label, t) {
      current = 0; errors = 0; total = t; phase = label;
      win.webContents.send('progress-update', { phase, current, total, message: '' });
    },
    tick() {
      current++;
      win.webContents.send('progress-update', { phase, current, total, message: '' });
    },
    tickError() {
      current++; errors++;
      win.webContents.send('progress-update', { phase, current, total, message: `${errors} errores` });
    },
    stopProgress() { /* no-op for GUI */ },
  };

  try {
    const result = await runPipeline(config, { logger, signal: abortController.signal });

    // Calculate cost
    const pricing = MODEL_PRICING[config.geminiModel];
    let costStr = '';
    if (pricing) {
      const cost = (result.tokenUsage.inputTokens / 1_000_000) * pricing.input
                 + (result.tokenUsage.outputTokens / 1_000_000) * pricing.output;
      costStr = cost === 0 ? '$0.00 (gratis)' : `$${cost.toFixed(4)}`;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const elapsedStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    win.webContents.send('processing-complete', {
      totalProcessed: result.converted,
      errors: result.errors,
      elapsed: elapsedStr,
      cost: costStr,
      outputDir: config.outputDir,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    win.webContents.send('processing-error', { message });
  }
});
