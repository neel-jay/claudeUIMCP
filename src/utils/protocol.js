/**
 * Message Control Protocol (MCP) utility
 * Handles MCP message parsing, validation, and formatting
 */

const { logger } = require('./logger');

// Message types
const MESSAGE_TYPES = {
  // System messages
  SYSTEM_PING: 'system.ping',
  SYSTEM_PONG: 'system.pong',
  SYSTEM_INFO: 'system.info',
  SYSTEM_ERROR: 'system.error',
  SYSTEM_AUTH: 'system.auth',
  SYSTEM_AUTH_RESPONSE: 'system.auth_response',
  SYSTEM_REGISTER: 'system.register',
  SYSTEM_REGISTER_RESPONSE: 'system.register_response',
  
  // Claude messages
  CLAUDE_QUERY: 'claude.query',
  CLAUDE_RESPONSE: 'claude.response',
  CLAUDE_ERROR: 'claude.error',
  CLAUDE_STATUS: 'claude.status',
  CLAUDE_STREAM_START: 'claude.stream.start',
  CLAUDE_STREAM_CONTENT: 'claude.stream.content',
  CLAUDE_STREAM_END: 'claude.stream.end',
  
  // Client messages
  CLIENT_IDENTIFY: 'client.identify',
  CLIENT_HEARTBEAT: 'client.heartbeat'
};

// Error codes
const ERROR_CODES = {
  INVALID_MESSAGE: 100,
  INVALID_TYPE: 101,
  INVALID_FORMAT: 102,
  UNAUTHORIZED: 200,
  FORBIDDEN: 201,
  NOT_FOUND: 300,
  SERVER_ERROR: 500
};

class MessageProtocol {
  constructor(options = {}) {
    this.version = options.version || '1.0';
    this.validateMessages = options.validateMessages !== false;
  }
  
  /**
   * Validate a message
   */
  validateMessage(message) {
    if (!message || typeof message !== 'object') {
      return {
        valid: false,
        error: 'Message must be an object'
      };
    }
    
    // Check required fields
    if (!message.type) {
      return {
        valid: false,
        error: 'Message type is required'
      };
    }
    
    // Check if message type is valid
    const validTypes = Object.values(MESSAGE_TYPES);
    if (!validTypes.includes(message.type)) {
      logger.warn(`Unknown message type: ${message.type}`);
      // We don't reject unknown types - may be extensions
    }
    
    return { valid: true };
  }
  
  /**
   * Parse a raw message
   */
  parseMessage(rawMessage) {
    try {
      // Convert buffer to string if needed
      const messageString = Buffer.isBuffer(rawMessage) 
        ? rawMessage.toString('utf8') 
        : rawMessage;
      
      // Parse JSON
      const message = JSON.parse(messageString);
      
      // Validate if enabled
      if (this.validateMessages) {
        const validation = this.validateMessage(message);
        if (!validation.valid) {
          logger.warn('Invalid message', { error: validation.error, message });
          return null;
        }
      }
      
      return message;
    } catch (error) {
      logger.error('Error parsing message', error);
      return null;
    }
  }
  
  /**
   * Create a new message
   */
  createMessage(type, data = {}, metadata = {}) {
    return {
      type,
      version: this.version,
      timestamp: Date.now(),
      data,
      ...metadata
    };
  }
  
  /**
   * Create a system message
   */
  createSystemMessage(subtype, data = {}) {
    const type = `system.${subtype}`;
    return this.createMessage(type, data);
  }
  
  /**
   * Create an error message
   */
  createErrorMessage(code, message, details = {}) {
    return this.createMessage(MESSAGE_TYPES.SYSTEM_ERROR, {
      code,
      message,
      details
    });
  }
  
  /**
   * Serialize a message to JSON
   */
  serializeMessage(message) {
    try {
      return JSON.stringify(message);
    } catch (error) {
      logger.error('Error serializing message', error);
      return null;
    }
  }
}

module.exports = {
  MessageProtocol,
  MESSAGE_TYPES,
  ERROR_CODES
};
