/**
 * Test script for MCP Server
 * This script creates a standalone instance of the MCP server without Electron
 */

const MCPServer = require('./src/server');
const { logger } = require('./src/utils/logger');

// Configure the logger to show debug messages
logger.level = 'debug';

// Create server instance
const server = new MCPServer({
  port: 3030,
  host: 'localhost',
  enablePlugins: true
});

// Set up event handlers
server.on('started', (data) => {
  console.log(`Server started on ${data.host}:${data.port}`);
});

server.on('stopped', (data) => {
  console.log('Server stopped');
  process.exit(0);
});

server.on('error', (data) => {
  console.error('Server error:', data.error);
});

server.on('connection', (data) => {
  console.log(`New client connected: ${data.id} from ${data.ipAddress}`);
});

server.on('disconnection', (data) => {
  console.log(`Client disconnected: ${data.id}`);
});

server.on('message', (data) => {
  console.log(`Message received: ${data.message.type}`);
});

// Start the server
console.log('Starting server...');
server.start()
  .then(() => {
    console.log('Server started successfully');
    
    // Set up shutdown handler
    process.on('SIGINT', async () => {
      console.log('Shutting down server...');
      await server.stop();
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
