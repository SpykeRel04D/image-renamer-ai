const fs = require('fs');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName === 'linux') {
    const sandboxPath = path.join(context.appOutDir, 'chrome-sandbox');
    if (fs.existsSync(sandboxPath)) {
      fs.unlinkSync(sandboxPath);
      console.log('Removed chrome-sandbox for Linux packaging');
    }
  }
};
