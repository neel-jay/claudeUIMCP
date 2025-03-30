const WebSocket = require('ws');
const EventEmitter = require('events');
const { ConnectionManager } = require('./connections');
const { MessageRouter } = require('./router');
const { ProtocolHandler } = require('./protocol');

/**
 * MCP Server implementation
 */
class MCPServer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: config.port || 3030,
      host: config.host || 'localhost',
      ...config
    };
    
    this.wss = null;
    this.isRunning = false;
    this.connectionManager = new ConnectionManager();
    this.messageRouter = new MessageRouter();
    this.protocolHandler = new ProtocolHandler();
    
    // Setup event handlers
    this.connectionManager.on('connection', this.handleConnection.bind(this));
    this.connectionManager.on('disconnect', this.handleDisconnect.bind(this));
    this.messageRouter.on('message', this.handleMessage.bind(this));
  }
  
  /**
   * Start the MCP server
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocket.Server({
          port: this.config.port,
          host: this.config.host,
        });
        
        this.wss.on('connection', (ws, req) => {
          const clientId = this.connectionManager.addConnection(ws, req);
          
          ws.on('message', (message) => {
            const parsedMessage = this.protocolHandler.parseMessage(message);
            if (parsedMessage) {
              this.messageRouter.routeMessage(clientId, parsedMessage);
            }
          });
          
          ws.on('close', () => {
            this.connectionManager.removeConnection(clientId);
          });
          
          ws.on('error', (error) => {
            this.emit('error', { clientId, error });
            this.connectionManager.removeConnection(clientId);
          });
        });
        
        this.wss.on('listening', () => {
          this.isRunning = true;
          this.emit('started', {
            port: this.config.port,
            host: this.config.host
          });
          resolve();
        });
        
        this.wss.on('error', (error) => {
          this.emit('error', { server: true, error });
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Stop the MCP server
   */
  async stop() {
    if (!this.isRunning) {
      throw new Error('Server is not running');
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.wss.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          
          this.isRunning = false;
          this.connectionManager.closeAllConnections();
          this.emit('stopped');
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Handle new client connection
   */
  handleConnection(client) {
    this.emit('connection', client);
  }
  
  /**
   * Handle client disconnect
   */
  handleDisconnect(clientId) {
    this.emit('disconnect', { clientId });
  }
  
  /**
   * Handle message from client
   */
  handleMessage(message) {
    this.emit('message', message);
  }
  
  /**
   * Get server status
   */
  getStatus() {
    return {
      running: this.isRunning,
      connections: this.connectionManager.getConnectionCount(),
      uptime: this.isRunning ? process.uptime() : 0,
      config: this.config
    };
  }
}

module.exports = MCPServer;
