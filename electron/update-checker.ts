import { app, BrowserWindow, dialog, net, shell } from 'electron';

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
    if (isNaN(rp) || isNaN(lp)) return false;
    if (rp > lp) return true;
    if (rp < lp) return false;
  }
  return false;
}

export async function checkForUpdates(win: BrowserWindow): Promise<void> {
  try {
    const res = await net.fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': `image-renamer-ai/${app.getVersion()}`,
        },
      }
    );
    if (!res.ok) return;

    const data = (await res.json()) as GitHubRelease;
    const remoteVersion = data.tag_name;
    const localVersion = app.getVersion();

    if (!isNewer(remoteVersion, localVersion)) return;

    if (win.isDestroyed()) return;

    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Actualización disponible',
      message: `Hay una nueva versión disponible: ${remoteVersion.replace(/^v/, '')}.\nTu versión actual es: ${localVersion}.`,
      buttons: ['Descargar', 'Cerrar'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      await shell.openExternal(data.html_url);
    }
  } catch {
    // No internet or API error — fail silently
  }
}
