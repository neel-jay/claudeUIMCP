const { contextBridge, ipcRenderer } = require('electron');

// Expose selected APIs to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Server controls
  getServerStatus: async () => {
    try {
      return await ipcRenderer.invoke('get-server-status');
    } catch (error) {
      console.error('Error getting server status:', error);
      return { status: 'unknown', config: {} };
    }
  },
  startServer: () => ipcRenderer.send('start-server'),
  stopServer: () => ipcRenderer.send('stop-server'),
  restartServer: () => ipcRenderer.send('restart-server'),
  
  // Configuration
  saveConfig: async (config) => {
    try {
      return await ipcRenderer.invoke('save-config', config);
    } catch (error) {
      console.error('Error saving config:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Connections API
  getConnections: async () => {
    try {
      return await ipcRenderer.invoke('get-connections');
    } catch (error) {
      console.error('Error getting connections:', error);
      return [];
    }
  },
  
  getConnection: async (connectionId) => {
    try {
      return await ipcRenderer.invoke('get-connection', connectionId);
    } catch (error) {
      console.error('Error getting connection:', error);
      return null;
    }
  },
  
  disconnectClient: async (connectionId) => {
    try {
      return await ipcRenderer.invoke('disconnect-client', connectionId);
    } catch (error) {
      console.error('Error disconnecting client:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Plugin API
  getPlugins: async () => {
    try {
      return await ipcRenderer.invoke('get-plugins');
    } catch (error) {
      console.error('Error getting plugins:', error);
      return [];
    }
  },
  
  enablePlugin: async (pluginName) => {
    try {
      return await ipcRenderer.invoke('enable-plugin', pluginName);
    } catch (error) {
      console.error('Error enabling plugin:', error);
      return { success: false, error: error.message };
    }
  },
  
  disablePlugin: async (pluginName) => {
    try {
      return await ipcRenderer.invoke('disable-plugin', pluginName);
    } catch (error) {
      console.error('Error disabling plugin:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Logs API
  getLogs: async (options) => {
    try {
      return await ipcRenderer.invoke('get-logs', options);
    } catch (error) {
      console.error('Error getting logs:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Events
  onServerStatus: (callback) => {
    ipcRenderer.on('server-status', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('server-status', callback);
  },
  
  onConfigSaved: (callback) => {
    ipcRenderer.on('config-saved', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('config-saved', callback);
  },
  
  onConnectionUpdate: (callback) => {
    ipcRenderer.on('connection-update', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('connection-update', callback);
  },
  
  onPluginUpdate: (callback) => {
    ipcRenderer.on('plugin-update', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('plugin-update', callback);
  },
  
  onLogUpdate: (callback) => {
    ipcRenderer.on('log-update', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('log-update', callback);
  }
});
