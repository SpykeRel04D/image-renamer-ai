# Update Checker — Design Spec

## Overview

Add a startup update checker that queries the GitHub Releases API, compares the latest release tag against the app's current version, and shows a native Electron dialog prompting the user to download the new version if one is available.

## Behavior

1. After the main `BrowserWindow` is ready, call `checkForUpdates(win)`.
2. Fetch `GET https://api.github.com/repos/SpykeRel04D/image-renamer-ai/releases/latest` using Electron's `net.fetch`.
3. Extract `tag_name` from the JSON response. Strip a leading `v` if present (e.g. `v1.0.8` → `1.0.8`).
4. Compare with `app.getVersion()` (reads `version` from `package.json`).
5. If the remote version is newer, show a native dialog:
   - **Title:** "Actualización disponible"
   - **Message:** "Hay una nueva versión disponible: {remote}. Tu versión actual es: {current}."
   - **Buttons:** "Descargar" | "Cerrar"
6. If the user clicks "Descargar", open `https://github.com/SpykeRel04D/image-renamer-ai/releases/tag/{tag_name}` in the default browser via `shell.openExternal`.
7. If the fetch fails for any reason (no internet, API error, timeout), fail silently — the app continues normally.

## Frequency

- Checks on every app launch. No persistence or cooldown.

## Version Comparison

Simple semver comparison: split both versions on `.`, compare each numeric segment left to right. A remote segment greater than the local segment at the same position means "newer". No pre-release or build metadata handling needed — this project uses simple `MAJOR.MINOR.PATCH` versions.

## Files

| File | Action |
|------|--------|
| `electron/update-checker.ts` | **Create** — exports `checkForUpdates(win: BrowserWindow): Promise<void>` |
| `electron/main.ts` | **Modify** — import and call `checkForUpdates` after window is ready |

## Constraints

- No new dependencies.
- No changes to the renderer, preload, or build config.
- Non-blocking: the app window loads immediately; the update check runs concurrently.
- The dialog is parented to the main window so it appears on top.

## Out of Scope

- Auto-download or auto-install of updates.
- Manual "check for updates" button in the UI.
- Persistent "already dismissed" state between sessions.
