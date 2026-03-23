# Image Renamer AI

[![GitHub Release](https://img.shields.io/github/v/release/SpykeRel04D/image-renamer-ai)](https://github.com/SpykeRel04D/image-renamer-ai/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/SpykeRel04D/image-renamer-ai/total)](https://github.com/SpykeRel04D/image-renamer-ai/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Mac%20%7C%20Linux-lightgrey)]()

Rename your images with SEO-friendly names using AI (Google Gemini) and automatically convert them to WebP.

Available as a **desktop app** (Windows / Mac / Linux) or as a **CLI tool**.

## What it does

1. **Scans** a folder for images (PNG, JPG, TIFF, BMP, GIF, SVG, WebP)
2. **Analyzes** each image with Google Gemini to generate a descriptive, SEO-friendly filename in your chosen language
3. **Converts** images to WebP (SVGs are copied as-is)
4. **Generates** a `mapping.json` with the original-to-new name mapping

### Example

```
IMG_20240315_001.jpg  ->  rustic-sourdough-bread-golden-crust.webp
DSC_0042.png          ->  butter-croissant-flaky-golden.webp
logo.svg              ->  logo.svg (copied unchanged)
```

## Download

Go to [**Releases**](../../releases) and download:

- **Windows**: `.exe` installer
- **Mac**: `.dmg` — drag to Applications
- **Linux**: `.AppImage` — run directly, no installation needed

> You need a Gemini API key (free). Get one at [Google AI Studio](https://aistudio.google.com/apikey).

## Desktop App

Open the app, configure, and click **Procesar**:

| Field | Description |
|-------|-------------|
| Input folder | Folder with original images |
| Output folder | Where processed images are saved |
| Gemini API Key | Your API key (stored locally) |
| Language | Language for generated names (e.g. "English", "español de España") |
| Context | Image domain (e.g. "artisan bakery", "e-commerce", "travel blog") |
| Model | Gemini model to use (`gemini-2.5-flash-lite` is free) |
| Concurrency | Parallel API calls (1-10) |
| RPM | Requests per minute limit (1-60) |
| WebP Quality | Compression quality (1-100) |

The app shows real-time progress with a log panel. Settings are remembered between sessions.

## CLI

For advanced users or automation:

### Requirements

- Node.js 18+
- Gemini API key as environment variable or in `.env`

### Installation

```bash
git clone https://github.com/SpykeRel04D/image-renamer-ai.git
cd image-renamer-ai
npm install
```

### Configuration

Create a `.env` file:

```
GEMINI_API_KEY=your_api_key_here
```

Optionally, create a `config.json` for default values:

```json
{
  "input": "./media",
  "output": "./processed",
  "language": "English",
  "context": "e-commerce",
  "model": "gemini-2.5-flash-lite",
  "concurrency": 3,
  "rpm": 15,
  "quality": 80
}
```

### Usage

```bash
# Full pipeline: scan + analyze + convert
npm run process

# Dry run: preview names without converting
npm run process:dry

# Analyze only: save names to DB, skip conversion
npm run process:analyze

# Convert only: skip analysis, convert previously analyzed images
npm run process:convert

# Reset: clear state and start fresh
npm run process:reset
```

### CLI Options

```
--input <dir>       Input directory
--output <dir>      Output directory
--model <model>     Gemini model
--language <lang>   Language for generated names
--context <ctx>     Image context/domain
--concurrency <n>   Parallel API calls
--rpm <n>           Requests per minute limit
--quality <n>       WebP quality (1-100)
--dry-run           Preview names without converting
--analyze-only      Only analyze
--convert-only      Only convert
--reset             Clear state
--verbose           Detailed logs
```

## Development

### Run the Electron app in dev mode

```bash
npm run electron:dev
```

### Build distributables

```bash
npm run dist:linux    # .AppImage
npm run dist:mac      # .dmg
npm run dist:win      # .exe
```

## Available Models

| Model | Price |
|-------|-------|
| `gemini-2.5-flash-lite` | Free |
| `gemini-2.0-flash-lite` | $0.075 / 1M input tokens |
| `gemini-2.0-flash` | $0.10 / 1M input tokens |
| `gemini-2.5-flash` | $0.15 / 1M input tokens |
| `gemini-2.5-pro` | $1.25 / 1M input tokens |

## Tech Stack

- [Google Gemini](https://ai.google.dev/) — Vision AI for image analysis
- [Sharp](https://sharp.pixelplumbing.com/) — WebP conversion
- [Electron](https://www.electronjs.org/) — Cross-platform desktop app
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Persistent state for resumable processing

## License

MIT
