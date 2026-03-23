# Image Renamer AI — Electron GUI Design Spec

## Goal

Wrap the existing CLI image-renamer-ai tool in a cross-platform Electron desktop app so that non-technical users on Linux and Mac can use it without installing Node.js or touching a terminal. Users open the app, configure settings, click "Procesar", and watch progress in real time.

## Target users

Non-technical end users who have no development tools installed. They download a `.dmg` (Mac) or `.AppImage` (Linux), open it, and it works. Each user provides their own Gemini API key (free from Google AI Studio).

## Architecture

### Two-process model

**Main process** (`electron/main.ts`):
- Creates the BrowserWindow
- Registers IPC handlers for folder selection and processing
- Runs the existing pipeline from `src/` (scanner → analyzer → converter → reporter)
- Emits progress events to the renderer via IPC
- Manages config persistence with `electron-store`

**Renderer process** (`electron/renderer/`):
- Single-page HTML/CSS/JS GUI (no framework — vanilla JS)
- Displays the config form, progress bar, and log panel
- Communicates with main process exclusively via the preload bridge

**Preload script** (`electron/preload.ts`):
- Exposes a safe `window.api` object via `contextBridge`
- No direct access to Node.js from the renderer (contextIsolation: true)

### Reuse of existing code

All files in `src/` are reused without modification except:

- **`src/reporter.ts`**: Modified to accept an optional event emitter. When running in Electron, progress events are emitted via IPC instead of writing to `cli-progress`. The CLI path continues to work as before.
- **`src/index.ts`**: Remains the CLI entry point, untouched. Electron has its own entry point at `electron/main.ts`.
- **`src/config.ts`**: No changes. The Electron main process constructs a `ProcessingConfig` object from the GUI form values and passes it directly to the pipeline.

## GUI layout — single page

All UI on one scrollable page, top to bottom:

### Header
- App title: "Image Renamer AI"

### Config form

| Field | Type | Notes |
|-------|------|-------|
| Carpeta de entrada | Path selector | Button opens native folder dialog |
| Carpeta de salida | Path selector | Button opens native folder dialog |
| Gemini API Key | Password input | Masked, stored in electron-store |
| Idioma | Text input | Default: "español de España" |
| Contexto | Text input | Default: "e-commerce" |
| Modelo | Dropdown | Options from MODEL_PRICING in reporter.ts: gemini-2.0-flash, gemini-2.5-flash-lite, gemini-2.0-flash-lite, gemini-2.5-flash, gemini-2.5-pro |
| Concurrencia | Number input | Default: 3, range 1-10 |
| RPM | Number input | Default: 15, range 1-60 |
| Calidad WebP | Number input/slider | Default: 80, range 1-100 |

Layout: folder selectors on a 2-column grid, API key full width, language/context 2-column, advanced settings (model, concurrency, rpm, quality) on a 4-column row.

### Action button
- "Procesar" button, centered, prominent
- Disabled while processing; shows "Cancelar" during processing

### Progress section (visible once processing starts)
- Phase label: "Escaneando...", "Analizando imágenes...", "Convirtiendo...", "Generando reporte..."
- Progress bar with current/total count (e.g., "24/87")
- Percentage display

### Log panel
- Monospace scrollable panel, auto-scrolls to bottom
- Color-coded tags: `[scan]` blue, `[analyze]` amber, `[convert]` green, `[error]` red
- Shows last ~200 lines

### Completion summary
- When done: total processed, errors, time elapsed, cost estimate
- Button to open output folder in file manager

## IPC protocol

### Renderer → Main (invoke)

| Channel | Payload | Returns |
|---------|---------|---------|
| `select-folder` | `{ title: string }` | `string \| null` (selected path) |
| `start-processing` | `ProcessingConfig` | `void` (starts pipeline, events follow) |
| `cancel-processing` | — | `void` |
| `get-saved-config` | — | `SavedConfig \| null` |
| `save-config` | `SavedConfig` | `void` |
| `open-folder` | `{ path: string }` | `void` (opens in file manager) |

### Main → Renderer (events via `webContents.send`)

| Channel | Payload |
|---------|---------|
| `progress-update` | `{ phase: string, current: number, total: number, message: string }` |
| `log-entry` | `{ level: 'info' \| 'warn' \| 'error', tag: string, message: string }` |
| `processing-complete` | `{ totalProcessed: number, errors: number, elapsed: string, cost: string, outputDir: string }` |
| `processing-error` | `{ message: string }` |

## Preload API surface

```typescript
// Exposed as window.api
interface ElectronAPI {
  selectFolder(title: string): Promise<string | null>;
  startProcessing(config: ProcessingConfig): Promise<void>;
  cancelProcessing(): Promise<void>;
  getSavedConfig(): Promise<SavedConfig | null>;
  saveConfig(config: SavedConfig): Promise<void>;
  openFolder(path: string): Promise<void>;
  onProgressUpdate(callback: (data: ProgressData) => void): void;
  onLogEntry(callback: (data: LogEntry) => void): void;
  onProcessingComplete(callback: (data: CompleteSummary) => void): void;
  onProcessingError(callback: (data: { message: string }) => void): void;
}
```

## Config persistence

Using `electron-store` with this schema:

```typescript
interface SavedConfig {
  apiKey?: string;
  inputDir?: string;
  outputDir?: string;
  language: string;
  context: string;
  model: string;
  concurrency: number;
  rpm: number;
  quality: number;
}
```

Stored at:
- Linux: `~/.config/image-renamer-ai/config.json`
- Mac: `~/Library/Application Support/image-renamer-ai/config.json`

On app launch, saved values populate the form. On "Procesar", current form values are saved before processing starts.

## File structure

```
image-renamer-ai/
├── electron/
│   ├── main.ts              # Electron entry point
│   ├── preload.ts           # Context bridge
│   └── renderer/
│       ├── index.html        # GUI page
│       ├── styles.css        # Dark theme styles
│       └── app.js            # Renderer logic (form, progress, logs)
├── src/                      # Existing CLI code (unchanged except reporter.ts)
│   ├── index.ts              # CLI entry point (kept working)
│   ├── pipeline.ts
│   ├── scanner.ts
│   ├── analyzer.ts
│   ├── converter.ts
│   ├── reporter.ts           # Modified: optional IPC event emitter
│   ├── name-generator.ts
│   ├── db.ts
│   ├── rate-limiter.ts
│   ├── config.ts
│   └── types.ts
├── package.json              # Updated with electron deps and build config
├── tsconfig.json
├── config.json
└── .env.example
```

## Modifications to existing code

### `src/reporter.ts`
Add an optional `EventEmitter` parameter to progress-reporting functions. When provided (Electron mode), emit structured events instead of writing to `cli-progress`. When absent (CLI mode), behavior is unchanged.

### `src/pipeline.ts`
Accept an optional event emitter. Pass it through to reporter functions. Note: `runPipeline` has `console.log` calls directly in the function in addition to reporter calls — all output paths must be routed through the event emitter when in Electron mode.

### Cancellation

The `cancel-processing` IPC channel sets a shared `AbortController` signal. The pipeline checks `signal.aborted` before starting each image task. In-flight Gemini API calls are not cancelled (the API client doesn't support it), but no new tasks are started. The UI shows "Cancelado" and re-enables the "Procesar" button.

### Config mapping

The GUI form produces a subset of the full `Config` type (from `src/types.ts`). `electron/main.ts` constructs the full `Config` object, hardcoding CLI-only flags: `dryRun: false`, `analyzeOnly: false`, `convertOnly: false`, `verbose: false`, `reset: false`.

### No other `src/` files change.

## Build and distribution

### Dependencies to add

```json
{
  "devDependencies": {
    "electron": "^35.0.0",
    "electron-builder": "^25.0.0"
  },
  "dependencies": {
    "electron-store": "^10.0.0"
  }
}
```

### electron-builder config (in package.json)

```json
{
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
      "electron/renderer/**/*",
      "src/**/*",
      "node_modules/**/*"
    ]
  }
}
```

### npm scripts

```json
{
  "electron:dev": "tsc -p tsconfig.electron.json && electron .",
  "electron:build": "tsc -p tsconfig.electron.json",
  "dist": "npm run electron:build && electron-builder --mac --linux",
  "dist:mac": "npm run electron:build && electron-builder --mac",
  "dist:linux": "npm run electron:build && electron-builder --linux"
}
```

### Native dependencies note

`sharp` and `better-sqlite3` are native Node.js addons that must be rebuilt for Electron's Node ABI. `electron-builder` handles this automatically via its built-in `nativeRebuilder` — no extra config needed, but this is a common source of packaging issues to watch for during build testing.

### Separate tsconfig for Electron

`tsconfig.electron.json` compiles `electron/*.ts` to `dist-electron/`, keeping the existing `tsconfig.json` for the CLI unchanged.

## Visual style

- Dark theme (dark background, light text)
- Accent color: indigo (#4f46e5)
- System font stack
- Minimal, functional — no unnecessary decoration
- Consistent with the mockup shown in option A during brainstorming

## Out of scope

- Windows support (can be added later)
- Auto-update mechanism
- Drag-and-drop folder selection
- Image preview/thumbnail grid
- Multiple language UI (the UI itself is in Spanish)
- Code signing / notarization (can be added for distribution)

## Testing approach

- Manual testing of the GUI on both Linux and Mac
- Existing CLI pipeline logic has no tests currently — no new test infrastructure added
- Verify: folder selection dialogs work, config persistence loads/saves, progress events flow correctly, cancel works, error states display properly
