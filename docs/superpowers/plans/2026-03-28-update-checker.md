# Update Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On startup, check GitHub for a newer release and prompt the user to download it.

**Architecture:** A single new module `electron/update-checker.ts` exports `checkForUpdates`. It uses Electron's `net.fetch` to hit the GitHub Releases API, compares versions with a simple semver helper, and shows a native `dialog.showMessageBox` if a newer version exists. One line added to `main.ts` to call it after the window is ready.

**Tech Stack:** Electron (`net`, `dialog`, `shell`, `app`) — no new dependencies.

---

### File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `electron/update-checker.ts` | Create | Fetch latest release, compare versions, show dialog |
| `electron/main.ts` | Modify (line 55) | Import and call `checkForUpdates` after window creation |
| `tsconfig.electron.json` | Modify (line 15) | Add new file to `include` array |

---

### Task 1: Create `electron/update-checker.ts`

**Files:**
- Create: `electron/update-checker.ts`

- [ ] **Step 1: Create the update checker module**

Write the complete module:

```ts
import { app, dialog, shell, BrowserWindow } from 'electron';
import { net } from 'electron';

const REPO = 'SpykeRel04D/image-renamer-ai';

interface GitHubRelease {
  tag_name: string;
  html_url: string;
}

function isNewer(remote: string, local: string): boolean {
  const r = remote.replace(/^v/, '').split('.').map(Number);
  const l = local.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rp = r[i] ?? 0;
    const lp = l[i] ?? 0;
    if (rp > lp) return true;
    if (rp < lp) return false;
  }
  return false;
}

export async function checkForUpdates(win: BrowserWindow): Promise<void> {
  try {
    const res = await net.fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      { headers: { Accept: 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) return;

    const data = (await res.json()) as GitHubRelease;
    const remoteVersion = data.tag_name.replace(/^v/, '');
    const localVersion = app.getVersion();

    if (!isNewer(remoteVersion, localVersion)) return;

    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Actualización disponible',
      message: `Hay una nueva versión disponible: ${remoteVersion}.\nTu versión actual es: ${localVersion}.`,
      buttons: ['Descargar', 'Cerrar'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      await shell.openExternal(`https://github.com/${REPO}/releases/tag/${data.tag_name}`);
    }
  } catch {
    // No internet or API error — fail silently
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/update-checker.ts
git commit -m "feat: add update checker module"
```

---

### Task 2: Add new file to TypeScript config

**Files:**
- Modify: `tsconfig.electron.json:15`

The current `include` array only lists `electron/main.ts` explicitly. The new file must be added so TypeScript compiles it.

- [ ] **Step 1: Update the include array**

Change line 15 of `tsconfig.electron.json` from:

```json
"include": ["electron/main.ts", "src/**/*.ts"],
```

to:

```json
"include": ["electron/main.ts", "electron/update-checker.ts", "src/**/*.ts"],
```

- [ ] **Step 2: Commit**

```bash
git add tsconfig.electron.json
git commit -m "build: include update-checker in TypeScript config"
```

---

### Task 3: Wire up in main process

**Files:**
- Modify: `electron/main.ts:1-2, 55`

- [ ] **Step 1: Add import**

Add this import at the top of `electron/main.ts`, after the existing imports (after line 8):

```ts
import { checkForUpdates } from './update-checker.js';
```

- [ ] **Step 2: Call checkForUpdates after window creation**

Change line 55 from:

```ts
app.whenReady().then(createWindow);
```

to:

```ts
app.whenReady().then(() => {
  createWindow();
  if (mainWindow) {
    checkForUpdates(mainWindow);
  }
});
```

Note: `checkForUpdates` returns a Promise but we intentionally do not `await` it — the app should not block on the update check.

- [ ] **Step 3: Verify it compiles**

Run:
```bash
npm run electron:build
```

Expected: No TypeScript errors. Output files appear in `dist-electron/`.

- [ ] **Step 4: Manual smoke test**

Run:
```bash
npm run electron:dev
```

Expected: App opens normally. If the current version matches the latest release, no dialog appears. To test the dialog, temporarily change `version` in `package.json` to `0.0.1`, run again, and verify the dialog appears with "Descargar" and "Cerrar" buttons. Clicking "Descargar" should open the release page in the browser. Restore the version after testing.

- [ ] **Step 5: Commit**

```bash
git add electron/main.ts
git commit -m "feat: check for updates on app startup"
```
