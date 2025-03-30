const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
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
  tray = new Tray(path.join(__dirname, '../assets/tray-icon.png'));
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
}

// Start the MCP server
function startServer() {
  if (server) {
    console.log('Server is already running');
    return;
  }

  const MCPServer = require('./server');
  const config = store.get('serverConfig', {
    port: 3030,
    host: 'localhost'
  });

  server = new MCPServer(config);
  server.start()
    .then(() => {
      console.log(`Server started on ${config.host}:${config.port}`);
      if (mainWindow) {
        mainWindow.webContents.send('server-status', {
          status: 'running',
          config
        });
      }
    })
    .catch(err => {
      console.error('Failed to start server:', err);
      if (mainWindow) {
        mainWindow.webContents.send('server-status', {
          status: 'error',
          error: err.message
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
    .then(() => {
      console.log('Server stopped');
      server = null;
      if (mainWindow) {
        mainWindow.webContents.send('server-status', {
          status: 'stopped'
        });
      }
    })
    .catch(err => {
      console.error('Failed to stop server:', err);
      if (mainWindow) {
        mainWindow.webContents.send('server-status', {
          status: 'error',
          error: err.message
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
ipcMain.on('get-server-status', (event) => {
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
