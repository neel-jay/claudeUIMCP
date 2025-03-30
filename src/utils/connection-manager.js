/**
 * Connection Manager for Claude UI MCP Server
 * Handles client connections, authentication, and message routing
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');
const { logger } = require('./logger');
const { MessageProtocol, MESSAGE_TYPES, ERROR_CODES } = require('./protocol');
const { configManager } = require('./config');

class ConnectionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Initialize properties
    this.connections = new Map();
    this.protocol = new MessageProtocol();
    this.maxConnections = options.maxConnections || configManager.get('server.maxConnections', 50);
    this.idleTimeout = options.idleTimeout || configManager.get('server.idleTimeout', 300000);
    this.pingInterval = options.pingInterval || configManager.get('server.pingInterval', 30000);
    this.authRequired = options.authRequired || configManager.get('security.authRequired', false);
    
    // Set up ping interval
    this.pingIntervalId = setInterval(() => {
      this.pingConnections();
    }, this.pingInterval);
    
    // Bind methods to ensure proper 'this' context
    this.addConnection = this.addConnection.bind(this);
    this.removeConnection = this.removeConnection.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.pingConnections = this.pingConnections.bind(this);
  }
  
  /**
   * Add a new client connection
   */
  addConnection(socket, info = {}) {
    // Check if maximum connections reached
    if (this.connections.size >= this.maxConnections) {
      logger.warn('Maximum connections reached, rejecting new connection');
      
      // Send error message and close connection
      const errorMessage = this.protocol.createErrorMessage(
        ERROR_CODES.SERVER_ERROR, 
        'Maximum connections reached'
      );
      
      try {
        socket.send(this.protocol.serializeMessage(errorMessage));
        socket.close();
      } catch (error) {
        logger.error('Error sending max connections message', error);
      }
      
      return null;
    }
    
    // Generate a unique ID for the connection
    const id = this.generateConnectionId();
    
    // Create connection metadata
    const connection = {
      id,
      socket,
      ipAddress: info.ipAddress || (info.req ? info.req.socket.remoteAddress : 'unknown'),
      userAgent: info.userAgent || (info.req ? info.req.headers['user-agent'] : 'unknown'),
      connected: Date.now(),
      lastActivity: Date.now(),
      isAuthenticated: !this.authRequired,
      clientInfo: {},
      stats: {
        messagesReceived: 0,
        messagesSent: 0,
        errors: 0
      }
    };
    
    // Store the connection
    this.connections.set(id, connection);
    
    // Set up event handlers
    socket.on('message', (data) => {
      connection.lastActivity = Date.now();
      connection.stats.messagesReceived++;
      this.handleMessage(id, data);
    });
    
    socket.on('close', () => {
      this.removeConnection(id);
    });
    
    socket.on('error', (error) => {
      logger.error(`Connection error for ${id}`, error);
      connection.stats.errors++;
      this.removeConnection(id);
    });
    
    // Emit connection event
    this.emit('connection', { 
      id, 
      ipAddress: connection.ipAddress,
      userAgent: connection.userAgent,
      timestamp: connection.connected
    });
    
    logger.info(`New connection established: ${id} from ${connection.ipAddress}`);
    
    // Return the connection ID
    return id;
  }
  
  /**
   * Remove a client connection
   */
  removeConnection(id) {
    if (!this.connections.has(id)) {
      return false;
    }
    
    const connection = this.connections.get(id);
    
    // Close the WebSocket connection if it's still open
    if (connection.socket.readyState === 1) { // WebSocket.OPEN
      try {
        connection.socket.close();
      } catch (error) {
        logger.error(`Error closing connection ${id}`, error);
      }
    }
    
    // Remove the connection from the map
    this.connections.delete(id);
    
    // Emit disconnection event
    this.emit('disconnection', { id });
    
    logger.info(`Connection closed: ${id}`);
    
    return true;
  }
  
  /**
   * Handle a message from a client
   */
  handleMessage(connectionId, data) {
    if (!this.connections.has(connectionId)) {
      logger.warn(`Received message for unknown connection: ${connectionId}`);
      return;
    }
    
    const connection = this.connections.get(connectionId);
    
    // Parse the message
    const message = this.protocol.parseMessage(data);
    
    if (!message) {
      logger.warn(`Received invalid message from ${connectionId}`);
      
      // Send error message back to client
      this.sendError(connectionId, ERROR_CODES.INVALID_MESSAGE, 'Invalid message format');
      
      // Update stats
      connection.stats.errors++;
      
      return;
    }
    
    // Check authentication if required
    if (this.authRequired && !connection.isAuthenticated) {
      // Only allow auth messages if not authenticated
      if (message.type !== MESSAGE_TYPES.SYSTEM_AUTH) {
        logger.warn(`Unauthenticated message from ${connectionId}: ${message.type}`);
        
        // Send error message back to client
        this.sendError(connectionId, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
        
        // Update stats
        connection.stats.errors++;
        
        return;
      }
    }
    
    // Handle system messages
    if (message.type.startsWith('system.')) {
      this.handleSystemMessage(connectionId, message);
      return;
    }
    
    // Emit message event
    this.emit('message', { connectionId, message });
    
    // For other message types, we let external handlers deal with them
    logger.debug(`Received message from ${connectionId}: ${message.type}`);
  }
  
  /**
   * Handle system messages
   */
  handleSystemMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    
    switch (message.type) {
      case MESSAGE_TYPES.SYSTEM_PING:
        // Respond to ping with a pong
        this.sendMessage(connectionId, MESSAGE_TYPES.SYSTEM_PONG, {
          timestamp: Date.now(),
          echo: message.data
        });
        break;
        
      case MESSAGE_TYPES.SYSTEM_AUTH:
        // Handle authentication request
        this.handleAuthRequest(connectionId, message);
        break;
        
      case MESSAGE_TYPES.SYSTEM_REGISTER:
        // Handle client registration
        this.handleClientRegistration(connectionId, message);
        break;
        
      default:
        // Unknown system message type
        logger.warn(`Unknown system message type from ${connectionId}: ${message.type}`);
        this.emit('unknownMessage', { connectionId, message });
        break;
    }
  }
  
  /**
   * Handle authentication request
   */
  handleAuthRequest(connectionId, message) {
    const connection = this.connections.get(connectionId);
    
    // In a real implementation, you would validate credentials here
    // For now, we'll accept any auth request
    connection.isAuthenticated = true;
    logger.info(`Connection ${connectionId} authenticated`);
    
    // Send auth response
    this.sendMessage(connectionId, MESSAGE_TYPES.SYSTEM_AUTH_RESPONSE, {
      success: true,
      timestamp: Date.now(),
      expiresAt: Date.now() + configManager.get('security.tokenExpiration', 86400000)
    });
    
    // Emit authentication event
    this.emit('authenticated', { connectionId });
  }
  
  /**
   * Handle client registration
   */
  handleClientRegistration(connectionId, message) {
    const connection = this.connections.get(connectionId);
    
    // Update client information
    connection.clientInfo = {
      ...connection.clientInfo,
      ...(message.data || {})
    };
    
    logger.info(`Client registered: ${connectionId}`, connection.clientInfo);
    
    // Send registration response
    this.sendMessage(connectionId, MESSAGE_TYPES.SYSTEM_REGISTER_RESPONSE, {
      success: true,
      id: connectionId,
      timestamp: Date.now()
    });
    
    // Emit registration event
    this.emit('clientRegistered', { 
      connectionId, 
      clientInfo: connection.clientInfo
    });
  }
  
  /**
   * Send a message to a client
   */
  sendMessage(connectionId, type, data = {}) {
    if (!this.connections.has(connectionId)) {
      logger.warn(`Attempted to send message to unknown connection: ${connectionId}`);
      return false;
    }
    
    const connection = this.connections.get(connectionId);
    
    // Create the message
    const message = this.protocol.createMessage(type, data);
    
    // Serialize the message
    const serializedMessage = this.protocol.serializeMessage(message);
    
    if (!serializedMessage) {
      logger.error(`Failed to serialize message for ${connectionId}`);
      return false;
    }
    
    // Send the message
    try {
      connection.socket.send(serializedMessage);
      connection.lastActivity = Date.now();
      connection.stats.messagesSent++;
      return true;
    } catch (error) {
      logger.error(`Error sending message to ${connectionId}`, error);
      connection.stats.errors++;
      return false;
    }
  }
  
  /**
   * Send an error message to a client
   */
  sendError(connectionId, code, message, details = {}) {
    return this.sendMessage(connectionId, MESSAGE_TYPES.SYSTEM_ERROR, {
      code,
      message,
      details
    });
  }
  
  /**
   * Broadcast a message to all connections
   */
  broadcastMessage(type, data = {}, filter = null) {
    let count = 0;
    
    for (const [id, connection] of this.connections.entries()) {
      // Apply filter if provided
      if (filter && !filter(connection)) {
        continue;
      }
      
      if (this.sendMessage(id, type, data)) {
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Send ping messages to all connections to keep them alive
   */
  pingConnections() {
    const now = Date.now();
    
    for (const [id, connection] of this.connections.entries()) {
      // Check if connection has timed out
      if (now - connection.lastActivity > this.idleTimeout) {
        logger.info(`Connection ${id} timed out after ${this.idleTimeout}ms of inactivity`);
        this.removeConnection(id);
        continue;
      }
      
      // Send ping message
      this.sendMessage(id, MESSAGE_TYPES.SYSTEM_PING, {
        timestamp: now
      });
    }
  }
  
  /**
   * Get connection status
   */
  getStatus() {
    return {
      totalConnections: this.connections.size,
      maxConnections: this.maxConnections,
      authenticated: Array.from(this.connections.values())
        .filter(conn => conn.isAuthenticated)
        .length
    };
  }
  
  /**
   * Get all active connections
   */
  getConnections() {
    const connectionList = [];
    
    for (const [id, connection] of this.connections.entries()) {
      connectionList.push({
        id,
        ipAddress: connection.ipAddress,
        userAgent: connection.userAgent,
        connected: connection.connected,
        lastActivity: connection.lastActivity,
        isAuthenticated: connection.isAuthenticated,
        clientInfo: connection.clientInfo,
        stats: connection.stats
      });
    }
    
    return connectionList;
  }
  
  /**
   * Get information about a specific connection
   */
  getConnection(id) {
    if (!this.connections.has(id)) {
      return null;
    }
    
    const connection = this.connections.get(id);
    
    return {
      id,
      ipAddress: connection.ipAddress,
      userAgent: connection.userAgent,
      connected: connection.connected,
      lastActivity: connection.lastActivity,
      isAuthenticated: connection.isAuthenticated,
      clientInfo: connection.clientInfo,
      stats: connection.stats
    };
  }
  
  /**
   * Close all connections
   */
  closeAllConnections() {
    for (const id of this.connections.keys()) {
      this.removeConnection(id);
    }
  }
  
  /**
   * Clean up resources when shutting down
   */
  shutdown() {
    // Clear ping interval
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
    
    // Close all connections
    this.closeAllConnections();
    
    logger.info('Connection manager shut down');
  }
  
  /**
   * Generate a unique connection ID
   */
  generateConnectionId() {
    return crypto.randomUUID();
  }
}

module.exports = {
  ConnectionManager
};
