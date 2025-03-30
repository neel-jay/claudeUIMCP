const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Manages WebSocket client connections
 */
class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
  }
  
  /**
   * Add a new WebSocket connection
   */
  addConnection(ws, req) {
    const clientId = this.generateClientId();
    const ip = req.socket.remoteAddress;
    const timestamp = Date.now();
    
    const connectionInfo = {
      id: clientId,
      ip,
      connected: timestamp,
      lastActivity: timestamp,
      ws
    };
    
    this.connections.set(clientId, connectionInfo);
    
    // Emit connection event
    this.emit('connection', {
      id: clientId,
      ip,
      timestamp
    });
    
    return clientId;
  }
  
  /**
   * Remove a WebSocket connection
   */
  removeConnection(clientId) {
    if (!this.connections.has(clientId)) {
      return false;
    }
    
    const connection = this.connections.get(clientId);
    this.connections.delete(clientId);
    
    // Emit disconnect event
    this.emit('disconnect', clientId);
    
    return true;
  }
  
  /**
   * Close a specific connection
   */
  closeConnection(clientId) {
    if (!this.connections.has(clientId)) {
      return false;
    }
    
    const connection = this.connections.get(clientId);
    connection.ws.close();
    
    return true;
  }
  
  /**
   * Close all connections
   */
  closeAllConnections() {
    this.connections.forEach((connection) => {
      connection.ws.close();
    });
    
    this.connections.clear();
  }
  
  /**
   * Send message to a specific client
   */
  sendMessage(clientId, message) {
    if (!this.connections.has(clientId)) {
      return false;
    }
    
    const connection = this.connections.get(clientId);
    
    try {
      const messageString = typeof message === 'string' 
        ? message 
        : JSON.stringify(message);
      
      connection.ws.send(messageString);
      connection.lastActivity = Date.now();
      return true;
    } catch (error) {
      this.emit('error', { clientId, error });
      return false;
    }
  }
  
  /**
   * Broadcast message to all clients
   */
  broadcastMessage(message, excludeClientId = null) {
    const messageString = typeof message === 'string' 
      ? message 
      : JSON.stringify(message);
    
    this.connections.forEach((connection, clientId) => {
      if (excludeClientId === clientId) {
        return;
      }
      
      try {
        connection.ws.send(messageString);
        connection.lastActivity = Date.now();
      } catch (error) {
        this.emit('error', { clientId, error });
      }
    });
  }
  
  /**
   * Get all active connections
   */
  getConnections() {
    const connectionList = [];
    
    this.connections.forEach((connection, clientId) => {
      connectionList.push({
        id: clientId,
        ip: connection.ip,
        connected: connection.connected,
        lastActivity: connection.lastActivity
      });
    });
    
    return connectionList;
  }
  
  /**
   * Get connection count
   */
  getConnectionCount() {
    return this.connections.size;
  }
  
  /**
   * Generate a unique client ID
   */
  generateClientId() {
    return crypto.randomUUID();
  }
}

module.exports = { ConnectionManager };
