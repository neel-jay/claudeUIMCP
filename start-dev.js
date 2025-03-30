/**
 * Development startup script for Claude UI MCP Server
 * This script starts a simple HTTP server to serve the frontend files
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Create a simple HTTP server to serve the HTML and assets
const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = path.extname(filePath);
  let contentType = 'text/html';
  
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
    case '.jpeg':
      contentType = 'image/jpeg';
      break;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Development server running at http://localhost:${PORT}/`);
  console.log('Starting Electron...');
  
// Start Electron with debug flags
  const electron = spawn('electron', ['.', '--dev', '--enable-logging'], { 
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: 1,
      DEBUG: '*'
    }
  });
  
  electron.on('close', (code) => {
    console.log(`Electron process exited with code ${code}`);
    process.exit(code);
  });
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down servers...');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
