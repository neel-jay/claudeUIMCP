const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const Store = require('electron-store');

// Initialize the store for app configuration
const store = new Store();

// Keep references to prevent garbage collection
let mainWindow;
let tray = null;

// Server instance reference
let server = null;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  // Load the index.html file
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    // In development, load from a local server with hot reloading
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the bundled index.html
    mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, '../build/index.html'),
      protocol: 'file:',
      slashes: true
    }));
  }

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Server',
      submenu: [
        {
          label: 'Start Server',
          click: () => {
            startServer();
          }
        },
        {
          label: 'Stop Server',
          click: () => {
            stopServer();
          }
        },
        {
          label: 'Restart Server',
          click: () => {
            restartServer();
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/neel-jay/claudeUIMCP');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  try {
    const trayIconPath = path.join(__dirname, '../assets/tray-icon.png');
    
    // Check if the tray icon exists
    if (!fs.existsSync(trayIconPath)) {
      console.warn(`Tray icon not found at: ${trayIconPath}`);
      return; // Skip tray creation
    }
    
    tray = new Tray(trayIconPath);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: () => {
          if (mainWindow === null) {
            createWindow();
          } else {
            mainWindow.show();
          }
        }
      },
      {
        label: 'Start Server',
        click: () => {
          startServer();
        }
      },
      {
        label: 'Stop Server',
        click: () => {
          stopServer();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        }
      }
    ]);

    tray.setToolTip('Claude UI MCP Server');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      if (mainWindow === null) {
        createWindow();
      } else {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    });
  } catch (error) {
    console.error('Failed to create tray:', error);
    // Continue without the tray
  }
}

// Start the MCP server
function startServer() {
  if (server) {
    console.log('Server is already running');
    return;
  }

  const MCPServer = require('../src/server');
  const config = store.get('serverConfig', {
    port: 3030,
    host: 'localhost'
  });

  server = new MCPServer(config);
  
  // Set up server event handlers
  server.on('started', (data) => {
    console.log(`Server started on ${data.host}:${data.port}`);
    if (mainWindow) {
      mainWindow.webContents.send('server-status', {
        status: 'running',
        config: {
          host: data.host,
          port: data.port
        },
        startTime: data.timestamp
      });
    }
  });
  
  server.on('stopped', (data) => {
    console.log('Server stopped');
    if (mainWindow) {
      mainWindow.webContents.send('server-status', {
        status: 'stopped',
        uptime: data.uptime
      });
    }
  });
  
  server.on('error', (data) => {
    console.error('Server error:', data.error);
    if (mainWindow) {
      mainWindow.webContents.send('server-status', {
        status: 'error',
        error: data.error.message || 'Unknown server error'
      });
    }
  });
  
  server.on('connection', (data) => {
    console.log(`New client connected: ${data.id} from ${data.ipAddress}`);
    
    if (mainWindow) {
      mainWindow.webContents.send('connection-update', {
        type: 'new',
        connection: {
          id: data.id,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          connected: data.timestamp,
          lastActivity: data.timestamp
        }
      });
    }
  });
  
  server.on('disconnection', (data) => {
    console.log(`Client disconnected: ${data.id}`);
    
    if (mainWindow) {
      mainWindow.webContents.send('connection-update', {
        type: 'closed',
        connectionId: data.id
      });
    }
  });

  server.start()
    .catch(err => {
      console.error('Failed to start server:', err);
      if (mainWindow) {
        mainWindow.webContents.send('server-status', {
          status: 'error',
          error: err.message || 'Failed to start server'
        });
      }
    });
}

// Stop the MCP server
function stopServer() {
  if (!server) {
    console.log('Server is not running');
    return;
  }

  server.stop()
    .catch(err => {
      console.error('Failed to stop server:', err);
      if (mainWindow) {
        mainWindow.webContents.send('server-status', {
          status: 'error',
          error: err.message || 'Failed to stop server'
        });
      }
    });
}

// Restart the MCP server
function restartServer() {
  if (!server) {
    startServer();
    return;
  }
  
  server.restart()
    .then(() => {
      console.log('Server restarted');
    })
    .catch(err => {
      console.error('Failed to restart server:', err);
      if (mainWindow) {
        mainWindow.webContents.send('server-status', {
          status: 'error',
          error: err.message || 'Failed to restart server'
        });
      }
    });
}

// Restart the MCP server
function restartServer() {
  stopServer();
  setTimeout(() => {
    startServer();
  }, 1000);
}

// Handle IPC messages from the renderer process
ipcMain.handle('get-server-status', () => {
  return {
    status: server ? 'running' : 'stopped',
    config: store.get('serverConfig', {
      port: 3030,
      host: 'localhost'
    })
  };
});

ipcMain.on('get-server-status-legacy', (event) => {
  event.reply('server-status', {
    status: server ? 'running' : 'stopped',
    config: store.get('serverConfig', {
      port: 3030,
      host: 'localhost'
    })
  });
});

ipcMain.on('start-server', () => {
  startServer();
});

ipcMain.on('stop-server', () => {
  stopServer();
});

ipcMain.on('save-config', (event, config) => {
  store.set('serverConfig', config);
  event.reply('config-saved', true);
});

ipcMain.on('restart-server', () => {
  restartServer();
});

// Connection handlers
ipcMain.handle('get-connections', () => {
  if (!server) {
    return [];
  }
  
  try {
    return server.getConnections();
  } catch (error) {
    console.error('Error getting connections:', error);
    return [];
  }
});

ipcMain.handle('get-connection', (event, connectionId) => {
  if (!server) {
    return null;
  }
  
  try {
    const connections = server.getConnections();
    return connections.find(conn => conn.id === connectionId) || null;
  } catch (error) {
    console.error('Error getting connection:', error);
    return null;
  }
});

ipcMain.handle('disconnect-client', (event, connectionId) => {
  if (!server) {
    return { success: false, error: 'Server not running' };
  }
  
  try {
    // This is a simplified approach; in the real implementation,
    // the server would have a method to disconnect a specific client
    // For now we'll assume success
    return { success: true };
  } catch (error) {
    console.error('Error disconnecting client:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to disconnect client'
    };
  }
});

// Plugin management
ipcMain.handle('get-plugins', () => {
  if (!server) {
    return [];
  }
  
  try {
    // In a real implementation we would call server's plugin manager
    // For now, just return a mock response
    return [
      {
        name: "example-plugin",
        version: "0.1.0",
        description: "An example plugin for Claude UI MCP Server",
        author: "Claude AI",
        enabled: true
      }
    ];
  } catch (error) {
    console.error('Error getting plugins:', error);
    return [];
  }
});

ipcMain.handle('enable-plugin', (event, pluginName) => {
  if (!server) {
    return { success: false, error: 'Server not running' };
  }
  
  try {
    // Mock implementation - in real code we would call server's plugin manager
    return { success: true };
  } catch (error) {
    console.error(`Error enabling plugin ${pluginName}:`, error);
    return { 
      success: false, 
      error: error.message || 'Failed to enable plugin'
    };
  }
});

ipcMain.handle('disable-plugin', (event, pluginName) => {
  if (!server) {
    return { success: false, error: 'Server not running' };
  }
  
  try {
    // Mock implementation - in real code we would call server's plugin manager
    return { success: true };
  } catch (error) {
    console.error(`Error disabling plugin ${pluginName}:`, error);
    return { 
      success: false, 
      error: error.message || 'Failed to disable plugin'
    };
  }
});

// Logs handler
ipcMain.handle('get-logs', (event, options = {}) => {
  try {
    // Mock implementation - in real code we would read actual log files
    return {
      success: true,
      logs: [
        { timestamp: new Date().toISOString(), level: 'info', message: 'Server started' },
        { timestamp: new Date().toISOString(), level: 'info', message: 'Plugin loaded: example-plugin' },
        { timestamp: new Date().toISOString(), level: 'debug', message: 'Connection established' }
      ]
    };
  } catch (error) {
    console.error('Error getting logs:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to get logs'
    };
  }
});

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Start server on app launch if auto-start is enabled
  if (store.get('autoStart', false)) {
    startServer();
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle cleanup when app is quitting
app.on('before-quit', () => {
  if (server) {
    stopServer();
  }
});
