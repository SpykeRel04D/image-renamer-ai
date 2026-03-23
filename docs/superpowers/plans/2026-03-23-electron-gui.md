# Electron GUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Electron GUI wrapper around the existing CLI tool, producing .dmg (Mac) and .AppImage (Linux) executables.

**Architecture:** Two-process Electron app. Main process reuses the existing pipeline via a `PipelineLogger` abstraction. Renderer is vanilla HTML/CSS/JS. IPC bridges the two.

**Tech Stack:** Electron 35, electron-builder, TypeScript, vanilla HTML/CSS/JS

**Spec:** `docs/superpowers/specs/2026-03-23-electron-gui-design.md`

---

## File Map

**New files:**
- `electron/main.ts` — Electron entry, IPC handlers, config persistence
- `electron/preload.cjs` — Context bridge (CJS for Electron compatibility)
- `electron/renderer/index.html` — GUI page
- `electron/renderer/styles.css` — Dark theme
- `electron/renderer/app.js` — Renderer logic
- `tsconfig.electron.json` — Compiles electron/ + src/ to dist-electron/

**Modified files:**
- `src/types.ts` — Add `PipelineLogger` interface, `PipelineResult` interface
- `src/reporter.ts` — Export `createCliLogger()`, export `MODEL_PRICING`
- `src/pipeline.ts` — Accept logger + AbortSignal, use logger, return `PipelineResult`
- `src/analyzer.ts` — Handle API key changes in singleton
- `package.json` — Add electron deps, main field, build config, scripts

---

### Task 1: Install dependencies and configure build infrastructure

**Files:**
- Modify: `package.json`
- Create: `tsconfig.electron.json`

- [ ] **Step 1: Install Electron dependencies**

```bash
npm install --save-dev electron electron-builder
```

- [ ] **Step 2: Create tsconfig.electron.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist-electron",
    "rootDir": ".",
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["electron/main.ts", "src/**/*.ts"],
  "exclude": ["node_modules", "dist", "dist-electron"]
}
```

- [ ] **Step 3: Update package.json**

Add `"main"` field, build config, and scripts:

```json
{
  "main": "dist-electron/electron/main.js",
  "scripts": {
    "electron:dev": "tsc -p tsconfig.electron.json && electron .",
    "electron:build": "tsc -p tsconfig.electron.json",
    "dist": "npm run electron:build && electron-builder --mac --linux",
    "dist:mac": "npm run electron:build && electron-builder --mac",
    "dist:linux": "npm run electron:build && electron-builder --linux"
  },
  "build": {
    "appId": "com.image-renamer-ai.app",
    "productName": "Image Renamer AI",
    "mac": {
      "target": "dmg"
    },
    "linux": {
      "target": "AppImage"
    },
    "files": [
      "dist-electron/**/*",
      "electron/preload.cjs",
      "electron/renderer/**/*"
    ]
  }
}
```

Keep existing scripts intact. Add `dist-electron/` to `.gitignore`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tsconfig.electron.json .gitignore
git commit -m "feat: add Electron build infrastructure"
```

---

### Task 2: Add PipelineLogger abstraction to types.ts

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add interfaces at the end of types.ts**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add PipelineLogger and PipelineResult interfaces"
```

---

### Task 3: Export createCliLogger and MODEL_PRICING from reporter.ts

**Files:**
- Modify: `src/reporter.ts`

- [ ] **Step 1: Add `export` to MODEL_PRICING (line 83)**

Change `const MODEL_PRICING` to `export const MODEL_PRICING`.

- [ ] **Step 2: Add createCliLogger function at the end of reporter.ts**

```typescript
import type { PipelineLogger } from './types.js';

// ... existing code ...

export function createCliLogger(): PipelineLogger {
  return {
    log: (_tag, message) => console.log(message),
    initProgress: initProgressBar,
    tick,
    tickError,
    stopProgress: stopProgressBar,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/reporter.ts
git commit -m "feat: export createCliLogger and MODEL_PRICING from reporter"
```

---

### Task 4: Modify pipeline.ts to use PipelineLogger

**Files:**
- Modify: `src/pipeline.ts`

This is the largest change. The pipeline accepts an optional `logger` and `signal`, routes all output through the logger, and returns a `PipelineResult`.

- [ ] **Step 1: Update imports, function signature, and move tokenUsage to top scope**

Add imports for new types. Change `runPipeline` signature. Move `tokenUsage` declaration to the top of the function so it's available in all code paths (currently it's inside the `if (!config.convertOnly)` block):

```typescript
import {
  createCliLogger, generateMappingJson, printTokenUsage, printSummary, printDryRunPreview,
} from './reporter.js';
import type { Config, ImageRecord, TokenUsage, PipelineLogger, PipelineResult } from './types.js';

export async function runPipeline(
  config: Config,
  options?: { logger?: PipelineLogger; signal?: AbortSignal }
): Promise<PipelineResult> {
  const logger = options?.logger ?? createCliLogger();
  const signal = options?.signal;
  const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };
```

Remove the existing `const tokenUsage` declaration from inside the Phase 2 block (line 44).

- [ ] **Step 2: Replace all console.log calls with logger.log**

Every `console.log(...)` in the pipeline becomes `logger.log(tag, message)`:

- `console.log('State cleared...')` → `logger.log('system', 'State cleared. Starting fresh.')`
- `console.log(\`Scanning...\`)` → `logger.log('scan', \`Scanning ${config.inputDir}...\`)`
- `console.log(\`Analyzing...\`)` → `logger.log('analyze', \`Analyzing ${pending.length} images...\`)`
- `console.log(\`Converting...\`)` → `logger.log('convert', \`Converting ${analyzed.length} images...\`)`
- `console.log(\`Mapping saved...\`)` → `logger.log('report', \`Mapping saved to: ${mappingPath}\`)`
- Error logs inside catch blocks → `logger.log('error', ...)`
- `'No pending images...'` and `'No analyzed images...'` messages → `logger.log(...)`

- [ ] **Step 3: Replace reporter function calls with logger methods**

- `logScanComplete(result)` → `logger.log('scan', \`Scan complete: ${result.total} images (${result.newImages} new, ${result.skipped} in DB)\`)`
- `initProgressBar(label, n)` → `logger.initProgress(label, n)`
- `tick()` → `logger.tick()`
- `tickError()` → `logger.tickError()`
- `stopProgressBar()` → `logger.stopProgress()`

Keep `printTokenUsage()`, `printSummary()`, `generateMappingJson()` as-is (they print to console which is fine for CLI and harmless in Electron).

- [ ] **Step 4: Add abort signal checks**

Before each task in `pending.map` and `analyzed.map`:

```typescript
semaphore(async () => {
  if (signal?.aborted) return;
  // ... rest of task
})
```

Also check before the convert phase:

```typescript
if (signal?.aborted) {
  closeDb();
  return { totalImages: 0, converted: 0, errors: 0, pending: 0, tokenUsage };
}
```

- [ ] **Step 5: Fix the dry-run/analyzeOnly early return**

The existing early return on lines 104-108 returns `void`. Change it to return a `PipelineResult`:

```typescript
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
```

- [ ] **Step 6: Return PipelineResult at the end**

After the report phase, before `closeDb()`:

```typescript
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
```

- [ ] **Step 7: Verify CLI still works**

```bash
npx tsx src/index.ts --help
```

Expected: help output, no errors.

- [ ] **Step 8: Commit**

```bash
git add src/pipeline.ts
git commit -m "feat: add PipelineLogger support and abort signal to pipeline"
```

---

### Task 5: Fix analyzer.ts API key singleton

**Files:**
- Modify: `src/analyzer.ts`

- [ ] **Step 1: Track current API key in singleton**

Replace the `getClient` function:

```typescript
let ai: InstanceType<typeof GoogleGenAI> | null = null;
let currentApiKey: string | null = null;

function getClient(config: Config): InstanceType<typeof GoogleGenAI> {
  if (!ai || currentApiKey !== config.geminiApiKey) {
    ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    currentApiKey = config.geminiApiKey;
  }
  return ai;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/analyzer.ts
git commit -m "fix: reset Gemini client when API key changes"
```

---

### Task 6: Create electron/preload.cjs

**Files:**
- Create: `electron/preload.cjs`

- [ ] **Step 1: Write preload script**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: (title) => ipcRenderer.invoke('select-folder', { title }),
  startProcessing: (config) => ipcRenderer.invoke('start-processing', config),
  cancelProcessing: () => ipcRenderer.invoke('cancel-processing'),
  getSavedConfig: () => ipcRenderer.invoke('get-saved-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', { path: folderPath }),
  onProgressUpdate: (callback) => {
    ipcRenderer.on('progress-update', (_event, data) => callback(data));
  },
  onLogEntry: (callback) => {
    ipcRenderer.on('log-entry', (_event, data) => callback(data));
  },
  onProcessingComplete: (callback) => {
    ipcRenderer.on('processing-complete', (_event, data) => callback(data));
  },
  onProcessingError: (callback) => {
    ipcRenderer.on('processing-error', (_event, data) => callback(data));
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload.cjs
git commit -m "feat: add Electron preload context bridge"
```

---

### Task 7: Create electron/main.ts

**Files:**
- Create: `electron/main.ts`

- [ ] **Step 1: Write main process**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add electron/main.ts
git commit -m "feat: add Electron main process with IPC handlers"
```

---

### Task 8: Create renderer GUI

**Files:**
- Create: `electron/renderer/index.html`
- Create: `electron/renderer/styles.css`
- Create: `electron/renderer/app.js`

- [ ] **Step 1: Create electron/renderer/index.html**

Single-page layout: config form → action button → progress bar → log panel → summary.

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Image Renamer AI</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>Image Renamer AI</h1>
      <p class="subtitle">Renombra imágenes con IA y convierte a WebP</p>
    </header>

    <form id="config-form">
      <div class="row">
        <div class="field">
          <label for="input-dir">Carpeta de entrada</label>
          <div class="path-selector">
            <input type="text" id="input-dir" readonly placeholder="Selecciona carpeta...">
            <button type="button" class="btn-secondary" data-select="input-dir">Elegir</button>
          </div>
        </div>
        <div class="field">
          <label for="output-dir">Carpeta de salida</label>
          <div class="path-selector">
            <input type="text" id="output-dir" readonly placeholder="Selecciona carpeta...">
            <button type="button" class="btn-secondary" data-select="output-dir">Elegir</button>
          </div>
        </div>
      </div>

      <div class="field">
        <label for="api-key">Gemini API Key</label>
        <input type="password" id="api-key" placeholder="AIza...">
      </div>

      <div class="row">
        <div class="field">
          <label for="language">Idioma</label>
          <input type="text" id="language" value="español de España">
        </div>
        <div class="field">
          <label for="context">Contexto</label>
          <input type="text" id="context" value="e-commerce">
        </div>
      </div>

      <div class="row row-4">
        <div class="field">
          <label for="model">Modelo</label>
          <select id="model">
            <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (gratis)</option>
            <option value="gemini-2.0-flash" selected>gemini-2.0-flash</option>
            <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            <option value="gemini-2.5-pro">gemini-2.5-pro</option>
          </select>
        </div>
        <div class="field">
          <label for="concurrency">Concurrencia</label>
          <input type="number" id="concurrency" value="3" min="1" max="10">
        </div>
        <div class="field">
          <label for="rpm">RPM</label>
          <input type="number" id="rpm" value="15" min="1" max="60">
        </div>
        <div class="field">
          <label for="quality">Calidad WebP</label>
          <input type="number" id="quality" value="80" min="1" max="100">
        </div>
      </div>

      <div class="actions">
        <button type="submit" id="btn-process" class="btn-primary">▶ Procesar</button>
        <button type="button" id="btn-cancel" class="btn-danger" style="display:none;">✕ Cancelar</button>
      </div>
    </form>

    <div id="progress-section" style="display:none;">
      <div class="progress-header">
        <span id="progress-phase">Procesando...</span>
        <span id="progress-count">0/0</span>
      </div>
      <div class="progress-bar">
        <div id="progress-fill" class="progress-fill"></div>
      </div>
    </div>

    <div id="log-panel" class="log-panel">
      <div id="log-content"></div>
    </div>

    <div id="summary-section" style="display:none;">
      <div class="summary">
        <h3>Procesamiento completado</h3>
        <div id="summary-content"></div>
        <button type="button" id="btn-open-folder" class="btn-secondary">Abrir carpeta de salida</button>
      </div>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create electron/renderer/styles.css**

Dark theme, indigo accent, system font:

```css
:root {
  --bg: #1a1a2e;
  --bg-secondary: #2a2a3e;
  --border: #444;
  --text: #e0e0e0;
  --text-secondary: #888;
  --accent: #4f46e5;
  --accent-hover: #4338ca;
  --danger: #ef4444;
  --success: #10b981;
  --warning: #f59e0b;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

.container { max-width: 720px; margin: 0 auto; padding: 24px; }

header { text-align: center; margin-bottom: 24px; }
h1 { font-size: 20px; font-weight: 700; }
.subtitle { color: var(--text-secondary); font-size: 13px; margin-top: 4px; }

.field { margin-bottom: 12px; }
.field label {
  display: block; font-size: 12px;
  color: var(--text-secondary); margin-bottom: 4px;
}

input, select {
  width: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--text);
  font-size: 13px;
  outline: none;
}
input:focus, select:focus { border-color: var(--accent); }
input:disabled, select:disabled { opacity: 0.5; }

.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.row-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }

.path-selector { display: flex; gap: 8px; }
.path-selector input { flex: 1; }

.btn-primary {
  background: var(--accent); color: #fff; border: none;
  border-radius: 6px; padding: 10px 32px;
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  background: transparent; color: var(--accent);
  border: 1px solid var(--accent); border-radius: 6px;
  padding: 8px 16px; font-size: 12px; cursor: pointer; white-space: nowrap;
}
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-danger {
  background: var(--danger); color: #fff; border: none;
  border-radius: 6px; padding: 10px 32px;
  font-size: 14px; font-weight: 600; cursor: pointer;
}

.actions { text-align: center; margin: 20px 0; }

.progress-header {
  display: flex; justify-content: space-between;
  font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;
}
.progress-bar {
  background: var(--bg-secondary); border-radius: 4px;
  height: 10px; overflow: hidden; margin-bottom: 16px;
}
.progress-fill {
  background: linear-gradient(90deg, var(--accent), #7c3aed);
  height: 100%; width: 0%; border-radius: 4px;
  transition: width 0.3s ease;
}

.log-panel {
  background: #0d0d1a; border: 1px solid #333; border-radius: 6px;
  padding: 12px; font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px; line-height: 1.6;
  max-height: 200px; overflow-y: auto; color: var(--text-secondary);
}
.log-scan { color: var(--accent); }
.log-analyze { color: var(--warning); }
.log-convert { color: var(--success); }
.log-error { color: var(--danger); }
.log-system { color: var(--text-secondary); }
.log-tokens { color: #a78bfa; }
.log-report { color: var(--text-secondary); }
.log-summary { color: var(--text); }

.summary {
  background: var(--bg-secondary); border-radius: 6px;
  padding: 16px; margin-top: 16px; text-align: center;
}
.summary h3 { font-size: 14px; margin-bottom: 8px; color: var(--success); }
#summary-content { font-size: 13px; margin-bottom: 12px; }
```

- [ ] **Step 3: Create electron/renderer/app.js**

```javascript
const form = document.getElementById('config-form');
const btnProcess = document.getElementById('btn-process');
const btnCancel = document.getElementById('btn-cancel');
const progressSection = document.getElementById('progress-section');
const progressPhase = document.getElementById('progress-phase');
const progressCount = document.getElementById('progress-count');
const progressFill = document.getElementById('progress-fill');
const logContent = document.getElementById('log-content');
const logPanel = document.getElementById('log-panel');
const summarySection = document.getElementById('summary-section');
const summaryContent = document.getElementById('summary-content');
const btnOpenFolder = document.getElementById('btn-open-folder');

let outputDir = '';
let logLines = 0;
const MAX_LOG_LINES = 200;

// --- Load saved config ---
(async () => {
  const config = await window.api.getSavedConfig();
  if (!config) return;
  if (config.apiKey) document.getElementById('api-key').value = config.apiKey;
  if (config.inputDir) document.getElementById('input-dir').value = config.inputDir;
  if (config.outputDir) document.getElementById('output-dir').value = config.outputDir;
  if (config.language) document.getElementById('language').value = config.language;
  if (config.context) document.getElementById('context').value = config.context;
  if (config.model) document.getElementById('model').value = config.model;
  if (config.concurrency) document.getElementById('concurrency').value = config.concurrency;
  if (config.rpm) document.getElementById('rpm').value = config.rpm;
  if (config.quality) document.getElementById('quality').value = config.quality;
})();

// --- Folder selection ---
document.querySelectorAll('[data-select]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const targetId = btn.dataset.select;
    const title = targetId === 'input-dir'
      ? 'Selecciona carpeta de entrada'
      : 'Selecciona carpeta de salida';
    const selectedPath = await window.api.selectFolder(title);
    if (selectedPath) {
      document.getElementById(targetId).value = selectedPath;
    }
  });
});

// --- Start processing ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const inputDir = document.getElementById('input-dir').value;
  const outDir = document.getElementById('output-dir').value;
  const apiKey = document.getElementById('api-key').value;

  if (!inputDir || !outDir || !apiKey) {
    alert('Completa: carpetas de entrada/salida y API key.');
    return;
  }

  outputDir = outDir;

  const config = {
    apiKey,
    inputDir,
    outputDir: outDir,
    language: document.getElementById('language').value,
    context: document.getElementById('context').value,
    model: document.getElementById('model').value,
    concurrency: parseInt(document.getElementById('concurrency').value),
    rpm: parseInt(document.getElementById('rpm').value),
    quality: parseInt(document.getElementById('quality').value),
  };

  await window.api.saveConfig(config);

  setProcessing(true);
  logContent.innerHTML = '';
  logLines = 0;
  summarySection.style.display = 'none';
  progressSection.style.display = 'block';
  progressFill.style.width = '0%';

  await window.api.startProcessing(config);
});

// --- Cancel ---
btnCancel.addEventListener('click', async () => {
  await window.api.cancelProcessing();
  addLog('system', 'Cancelado por el usuario.');
  setProcessing(false);
});

// --- IPC event listeners ---
window.api.onProgressUpdate((data) => {
  progressPhase.textContent = data.phase + '...';
  progressCount.textContent = `${data.current}/${data.total}`;
  const pct = data.total > 0 ? (data.current / data.total) * 100 : 0;
  progressFill.style.width = pct + '%';
});

window.api.onLogEntry((data) => {
  addLog(data.tag, data.message);
});

window.api.onProcessingComplete((data) => {
  setProcessing(false);
  progressFill.style.width = '100%';
  summarySection.style.display = 'block';
  summaryContent.innerHTML =
    `<p>Imágenes convertidas: <strong>${data.totalProcessed}</strong></p>` +
    `<p>Errores: <strong>${data.errors}</strong></p>` +
    (data.elapsed ? `<p>Tiempo: <strong>${data.elapsed}</strong></p>` : '') +
    (data.cost ? `<p>Coste estimado: <strong>${data.cost}</strong></p>` : '');
  outputDir = data.outputDir;
});

window.api.onProcessingError((data) => {
  setProcessing(false);
  addLog('error', 'Error fatal: ' + data.message);
});

// --- Open output folder ---
btnOpenFolder.addEventListener('click', () => {
  if (outputDir) window.api.openFolder(outputDir);
});

// --- Helpers ---
function setProcessing(active) {
  btnProcess.style.display = active ? 'none' : '';
  btnCancel.style.display = active ? '' : 'none';
  form.querySelectorAll('input, select').forEach(el => el.disabled = active);
  form.querySelectorAll('[data-select]').forEach(el => el.disabled = active);
}

function addLog(tag, message) {
  const line = document.createElement('div');
  line.innerHTML = `<span class="log-${tag}">[${tag}]</span> ${escapeHtml(message)}`;
  logContent.appendChild(line);
  logLines++;

  while (logLines > MAX_LOG_LINES && logContent.firstChild) {
    logContent.removeChild(logContent.firstChild);
    logLines--;
  }

  logPanel.scrollTop = logPanel.scrollHeight;
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}
```

- [ ] **Step 4: Commit**

```bash
git add electron/renderer/
git commit -m "feat: add Electron renderer GUI (HTML, CSS, JS)"
```

---

### Task 9: Compile and verify

- [ ] **Step 1: Compile TypeScript for Electron**

```bash
npm run electron:build
```

Expected: compiles without errors, creates `dist-electron/` with `electron/main.js` and `src/*.js`.

- [ ] **Step 2: Run in dev mode**

```bash
npm run electron:dev
```

Expected: Electron window opens with the dark-themed GUI. Test:
1. Folder selection dialogs open and return paths
2. Form fields are editable
3. Config persists between app restarts

- [ ] **Step 3: Test processing with real images**

1. Set API key, input folder (with a few test images), output folder
2. Click "Procesar"
3. Verify: progress bar updates, logs appear, images get processed
4. Verify: summary appears with correct counts
5. Verify: "Abrir carpeta de salida" opens the folder

- [ ] **Step 4: Test cancellation**

1. Start processing a large batch
2. Click "Cancelar"
3. Verify: processing stops, UI re-enables

- [ ] **Step 5: Verify CLI still works**

```bash
npx tsx src/index.ts --help
```

Expected: CLI help output unchanged.

- [ ] **Step 6: Build distributable (Linux)**

```bash
npm run dist:linux
```

Expected: `.AppImage` file created in `dist/` directory.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "feat: Electron GUI complete and verified"
```
