const { contextBridge, ipcRenderer } = require('electron');

// Expose selected APIs to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Server controls
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  startServer: () => ipcRenderer.send('start-server'),
  stopServer: () => ipcRenderer.send('stop-server'),
  
  // Configuration
  saveConfig: (config) => ipcRenderer.send('save-config', config),
  
  // Events
  onServerStatus: (callback) => {
    ipcRenderer.on('server-status', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('server-status', callback);
  },
  
  onConfigSaved: (callback) => {
    ipcRenderer.on('config-saved', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('config-saved', callback);
  },
  
  // Connections API
  onConnectionUpdate: (callback) => {
    ipcRenderer.on('connection-update', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('connection-update', callback);
  },
  
  disconnectClient: (clientId) => ipcRenderer.send('disconnect-client', clientId)
});
