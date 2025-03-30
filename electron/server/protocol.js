/**
 * Handles MCP protocol parsing and formatting
 */
class ProtocolHandler {
  constructor() {
    this.protocolVersion = '1.0';
  }
  
  /**
   * Parse a raw message
   */
  parseMessage(rawMessage) {
    try {
      // Check if the message is a buffer or string
      const messageString = Buffer.isBuffer(rawMessage) 
        ? rawMessage.toString('utf8') 
        : rawMessage;
      
      // Parse the JSON
      const message = JSON.parse(messageString);
      
      // Validate the message structure
      if (!this.validateMessage(message)) {
        return null;
      }
      
      return message;
    } catch (error) {
      console.error('Error parsing message:', error);
      return null;
    }
  }
  
  /**
   * Validate message structure
   */
  validateMessage(message) {
    // Check if message is an object
    if (typeof message !== 'object' || message === null) {
      return false;
    }
    
    // Check required fields
    if (!message.type) {
      return false;
    }
    
    // Validate the protocol version if provided
    if (message.version && message.version !== this.protocolVersion) {
      console.warn(`Protocol version mismatch: expected ${this.protocolVersion}, got ${message.version}`);
    }
    
    return true;
  }
  
  /**
   * Format a message according to the protocol
   */
  formatMessage(type, data = {}) {
    return {
      type,
      version: this.protocolVersion,
      timestamp: Date.now(),
      data
    };
  }
  
  /**
   * Format an error message
   */
  formatErrorMessage(code, message, details = {}) {
    return this.formatMessage('error', {
      code,
      message,
      details
    });
  }
  
  /**
   * Format a system message
   */
  formatSystemMessage(subtype, data = {}) {
    return this.formatMessage(`system.${subtype}`, data);
  }
}

module.exports = { ProtocolHandler };
