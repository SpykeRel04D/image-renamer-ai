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
