// CJS entry point — executes before ESM module loading.
// Disables Chromium sandbox on Linux to work around SUID and
// AppArmor user namespace restrictions (Ubuntu 24+).
if (process.platform === 'linux') {
  require('electron').app.commandLine.appendSwitch('no-sandbox');
}

// Dynamic import loads the real ESM entry point
import('./dist-electron/electron/main.js');
