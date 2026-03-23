const fs = require('fs');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'linux') return;

  // Remove chrome-sandbox to avoid SUID sandbox errors
  const sandboxPath = path.join(context.appOutDir, 'chrome-sandbox');
  if (fs.existsSync(sandboxPath)) {
    fs.unlinkSync(sandboxPath);
    console.log('afterPack: removed chrome-sandbox');
  }

  // Wrap the main executable so --no-sandbox is always passed.
  // Needed for Ubuntu 24+ where AppArmor blocks user namespaces.
  const execName = context.packager.appInfo.productFilename;
  const execPath = path.join(context.appOutDir, execName);

  if (fs.existsSync(execPath)) {
    const realBin = execPath + '.real';
    fs.renameSync(execPath, realBin);
    const wrapper = [
      '#!/bin/bash',
      'DIR="$(dirname "$(readlink -f "$0")")"',
      'exec "$DIR/' + execName + '.real" --no-sandbox "$@"',
      '',
    ].join('\n');
    fs.writeFileSync(execPath, wrapper);
    fs.chmodSync(execPath, 0o755);
    console.log('afterPack: created --no-sandbox wrapper for ' + execName);
  }
};
