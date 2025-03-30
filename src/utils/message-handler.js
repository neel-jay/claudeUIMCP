/**
 * Message Handler for Claude UI MCP Server
 * Handles processing of MCP messages and routing to appropriate handlers
 */

const { EventEmitter } = require('events');
const { logger } = require('./logger');
const { MESSAGE_TYPES } = require('./protocol');

class MessageHandler extends EventEmitter {
  constructor() {
    super();
    
    // Initialize handler registry
    this.handlers = new Map();
    
    // Register built-in handlers
    this.registerDefaultHandlers();
  }
  
  /**
   * Register default message handlers
   */
  registerDefaultHandlers() {
    // Echo handler - simply echoes back the message
    this.registerHandler('echo', async (message, context) => {
      return {
        type: 'echo.response',
        data: {
          echo: message.data,
          timestamp: Date.now()
        }
      };
    });
    
    // Status handler - returns server status
    this.registerHandler('status', async (message, context) => {
      return {
        type: 'status.response',
        data: {
          status: 'online',
          timestamp: Date.now(),
          version: '1.0.0',
          uptime: process.uptime()
        }
      };
    });
  }
  
  /**
   * Register a handler for a specific message type
   */
  registerHandler(type, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    this.handlers.set(type, handler);
    logger.debug(`Registered handler for message type: ${type}`);
  }
  
  /**
   * Unregister a handler for a specific message type
   */
  unregisterHandler(type) {
    const removed = this.handlers.delete(type);
    
    if (removed) {
      logger.debug(`Unregistered handler for message type: ${type}`);
    }
    
    return removed;
  }
  
  /**
   * Process a message and route to appropriate handler
   */
  async processMessage(message, context = {}) {
    if (!message || !message.type) {
      logger.warn('Invalid message format');
      return null;
    }
    
    try {
      // Check for direct handler match
      if (this.handlers.has(message.type)) {
        const handler = this.handlers.get(message.type);
        return await handler(message, context);
      }
      
      // Check for namespace handlers (e.g., "echo.request" -> "echo" handler)
      const namespace = message.type.split('.')[0];
      
      if (this.handlers.has(namespace)) {
        const handler = this.handlers.get(namespace);
        return await handler(message, context);
      }
      
      // No handler found, emit unhandled event
      this.emit('unhandled', { message, context });
      
      // Return error response
      return {
        type: 'error',
        data: {
          code: 404,
          message: `No handler found for message type: ${message.type}`,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      logger.error(`Error processing message of type ${message.type}`, error);
      
      // Emit error event
      this.emit('error', { message, error, context });
      
      // Return error response
      return {
        type: 'error',
        data: {
          code: 500,
          message: 'Error processing message',
          error: error.message,
          timestamp: Date.now()
        }
      };
    }
  }
}

// Create a singleton instance
const messageHandler = new MessageHandler();

module.exports = {
  MessageHandler,
  messageHandler
};
