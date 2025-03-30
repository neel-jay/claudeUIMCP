/**
 * Enhanced MCP Server Implementation
 * Main server module that ties together all components
 */

const WebSocket = require('ws');
const http = require('http');
const EventEmitter = require('events');
const { logger } = require('./utils/logger');
const { configManager } = require('./utils/config');
const { ConnectionManager } = require('./utils/connection-manager');
const { MessageProtocol, MESSAGE_TYPES } = require('./utils/protocol');
const { messageHandler } = require('./utils/message-handler');
const { proxyHandler } = require('./utils/proxy-handler');
const { pluginManager } = require('./utils/plugin-manager');

class MCPServer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Initialize properties
    this.port = options.port || configManager.get('server.port', 3030);
    this.host = options.host || configManager.get('server.host', 'localhost');
    this.httpServer = null;
    this.wsServer = null;
    this.isRunning = false;
    this.startTime = null;
    this.enablePlugins = options.enablePlugins !== false;
    
    // Initialize components
    this.connectionManager = new ConnectionManager();
    this.protocol = new MessageProtocol();
    
    // Register built-in message handlers
    this.registerBuiltInHandlers();
    
    // Set up event handlers for connection manager
    this.connectionManager.on('connection', (data) => {
      this.emit('connection', data);
    });
    
    this.connectionManager.on('disconnection', (data) => {
      this.emit('disconnection', data);
    });
    
    this.connectionManager.on('message', (data) => {
      this.handleMessage(data.connectionId, data.message);
    });
    
    // Set up event handlers for message handler
    messageHandler.on('unhandled', (data) => {
      logger.debug(`Unhandled message type: ${data.message.type}`);
    });
    
    messageHandler.on('error', (data) => {
      logger.error(`Error processing message: ${data.error.message}`);
    });
    
    // Bind methods to ensure proper 'this' context
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.handleConnection = this.handleConnection.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
  }
  
  /**
   * Start the MCP server
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Server is already running');
      return Promise.resolve();
    }
    
    return new Promise(async (resolve, reject) => {
      try {
        // Load plugins if enabled
        if (this.enablePlugins) {
          logger.info('Loading plugins...');
          await pluginManager.loadPlugins();
        }
        
        // Create HTTP server
        this.httpServer = http.createServer((req, res) => {
          // Basic HTTP endpoint for health checks
          if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              status: 'ok',
              uptime: this.isRunning ? Math.floor((Date.now() - this.startTime) / 1000) : 0
            }));
            return;
          }
          
          // API version endpoint
          if (req.url === '/api/version') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              name: 'Claude UI MCP Server',
              version: '0.1.0',
              apiVersion: '1.0'
            }));
            return;
          }
          
          // Return 404 for all other HTTP requests
          res.writeHead(404);
          res.end('Not found');
        });
        
        // Create WebSocket server
        this.wsServer = new WebSocket.Server({ server: this.httpServer });
        
        // Set up WebSocket connection handler
        this.wsServer.on('connection', this.handleConnection);
        
        // Set up error handler
        this.wsServer.on('error', (error) => {
          logger.error('WebSocket server error', error);
          this.emit('error', { server: true, error });
        });
        
        // Start HTTP server
        this.httpServer.listen(this.port, this.host, () => {
          this.isRunning = true;
          this.startTime = Date.now();
          
          logger.info(`MCP Server started on ${this.host}:${this.port}`);
          console.log(`Server started on ${this.host}:${this.port}`);
          
          this.emit('started', {
            port: this.port,
            host: this.host,
            timestamp: this.startTime
          });
          
          resolve();
        });
        
        // Handle HTTP server errors
        this.httpServer.on('error', (error) => {
          logger.error('HTTP server error', error);
          this.emit('error', { server: true, error });
          
          if (!this.isRunning) {
            reject(error);
          }
        });
      } catch (error) {
        logger.error('Failed to start server', error);
        reject(error);
      }
    });
  }
  
  /**
   * Stop the MCP server
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('Server is not running');
      return Promise.resolve();
    }
    
    return new Promise(async (resolve, reject) => {
      try {
        // Notify plugins about server shutdown
        if (this.enablePlugins) {
          logger.info('Notifying plugins about shutdown...');
          await pluginManager.callPluginMethod('onServerShutdown');
        }
        
        // Close all connections
        this.connectionManager.closeAllConnections();
        
        // Close the WebSocket server
        this.wsServer.close(() => {
          // Close the HTTP server
          this.httpServer.close((err) => {
            if (err) {
              logger.error('Error closing HTTP server', err);
              reject(err);
              return;
            }
            
            this.isRunning = false;
            this.wsServer = null;
            this.httpServer = null;
            
            logger.info('MCP Server stopped');
            console.log('Server stopped');
            
            this.emit('stopped', {
              timestamp: Date.now(),
              uptime: Math.floor((Date.now() - this.startTime) / 1000)
            });
            
            resolve();
          });
        });
      } catch (error) {
        logger.error('Failed to stop server', error);
        reject(error);
      }
    });
  }
  
  /**
   * Handle a new WebSocket connection
   */
  handleConnection(ws, req) {
    const connectionId = this.connectionManager.addConnection(ws, {
      req,
      ipAddress: req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    if (connectionId) {
      // Send welcome message
      this.connectionManager.sendMessage(connectionId, MESSAGE_TYPES.SYSTEM_INFO, {
        name: 'Claude UI MCP Server',
        version: '0.1.0',
        timestamp: Date.now(),
        message: 'Welcome to the Claude UI MCP Server'
      });
    }
  }
  
  /**
   * Handle a message from a client
   */
  async handleMessage(connectionId, message) {
    // Create context for message handlers
    const context = {
      connectionId,
      server: this,
      timestamp: Date.now()
    };
    
    try {
      // First check if any plugin wants to handle this message
      const pluginResults = await pluginManager.callPluginMethod('handleMessage', message, context);
      
      // Check if any plugin handled the message
      const handled = pluginResults.some(result => result.result === true);
      
      if (handled) {
        logger.debug(`Message of type ${message.type} handled by plugin`);
        return;
      }
      
      // Process with the message handler
      const response = await messageHandler.processMessage(message, context);
      
      if (response) {
        // Send response back to client
        this.connectionManager.sendMessage(connectionId, response.type, response.data);
      }
      
      // Emit message event for external handlers
      this.emit('message', {
        connectionId,
        message,
        timestamp: Date.now(),
        response
      });
    } catch (error) {
      logger.error(`Error handling message of type ${message.type}`, error);
      
      // Send error message to client
      this.connectionManager.sendError(connectionId, 500, 'Error processing message', {
        error: error.message
      });
    }
  }
  
  /**
   * Register a message handler
   */
  registerMessageHandler(type, handler) {
    messageHandler.registerHandler(type, handler);
  }
  
  /**
   * Register built-in message handlers
   */
  registerBuiltInHandlers() {
    // Server info handler
    this.registerMessageHandler('server.info', async (message, context) => {
      return {
        type: 'server.info.response',
        data: {
          name: 'Claude UI MCP Server',
          version: '0.1.0',
          uptime: this.isRunning ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
          connections: this.connectionManager.getStatus(),
          config: {
            host: this.host,
            port: this.port
          },
          plugins: pluginManager.getPlugins(),
          timestamp: Date.now()
        }
      };
    });
    
    // Custom echo handler with server timestamp
    this.registerMessageHandler('server.echo', async (message, context) => {
      return {
        type: 'server.echo.response',
        data: {
          echo: message.data,
          server_timestamp: Date.now(),
          message_timestamp: message.timestamp
        }
      };
    });
    
    // Proxy request handler
    this.registerMessageHandler('proxy.request', async (message, context) => {
      try {
        const { route, endpoint, method, data, headers } = message.data;
        
        if (!route || !endpoint) {
          return {
            type: 'proxy.error',
            data: {
              error: 'Missing required parameters: route, endpoint',
              timestamp: Date.now()
            }
          };
        }
        
        const response = await proxyHandler.forwardRequest(
          route,
          endpoint,
          method || 'GET',
          data,
          headers
        );
        
        return {
          type: 'proxy.response',
          data: {
            route,
            endpoint,
            response,
            timestamp: Date.now()
          }
        };
      } catch (error) {
        return {
          type: 'proxy.error',
          data: {
            error: error.message || 'Error processing proxy request',
            details: error,
            timestamp: Date.now()
          }
        };
      }
    });
    
    // Plugin management handlers
    this.registerMessageHandler('plugins.list', async (message, context) => {
      return {
        type: 'plugins.list.response',
        data: {
          plugins: pluginManager.getPlugins(),
          timestamp: Date.now()
        }
      };
    });
    
    this.registerMessageHandler('plugins.enable', async (message, context) => {
      const { name } = message.data;
      
      if (!name) {
        return {
          type: 'plugins.error',
          data: {
            error: 'Missing plugin name',
            timestamp: Date.now()
          }
        };
      }
      
      const success = pluginManager.enablePlugin(name);
      
      return {
        type: 'plugins.enable.response',
        data: {
          name,
          success,
          timestamp: Date.now()
        }
      };
    });
    
    this.registerMessageHandler('plugins.disable', async (message, context) => {
      const { name } = message.data;
      
      if (!name) {
        return {
          type: 'plugins.error',
          data: {
            error: 'Missing plugin name',
            timestamp: Date.now()
          }
        };
      }
      
      const success = pluginManager.disablePlugin(name);
      
      return {
        type: 'plugins.disable.response',
        data: {
          name,
          success,
          timestamp: Date.now()
        }
      };
    });
  }
  
  /**
   * Register a proxy route
   */
  registerProxyRoute(name, config) {
    proxyHandler.registerRoute(name, config);
  }
  
  /**
   * Get server status
   */
  getStatus() {
    return {
      running: this.isRunning,
      uptime: this.isRunning ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      startTime: this.startTime,
      host: this.host,
      port: this.port,
      connections: this.connectionManager.getStatus(),
      config: {
        host: this.host,
        port: this.port
      }
    };
  }
  
  /**
   * Get active connections
   */
  getConnections() {
    return this.connectionManager.getConnections();
  }
  
  /**
   * Restart the server
   */
  async restart() {
    try {
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      await this.start();
      return true;
    } catch (error) {
      logger.error('Failed to restart server', error);
      throw error;
    }
  }
}

module.exports = MCPServer;
