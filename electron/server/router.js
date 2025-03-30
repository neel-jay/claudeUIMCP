const EventEmitter = require('events');

/**
 * Routes messages between clients
 */
class MessageRouter extends EventEmitter {
  constructor() {
    super();
    this.routes = new Map();
  }
  
  /**
   * Register a route handler
   */
  registerRoute(type, handler) {
    if (!this.routes.has(type)) {
      this.routes.set(type, []);
    }
    
    this.routes.get(type).push(handler);
  }
  
  /**
   * Route a message
   */
  routeMessage(clientId, message) {
    const { type } = message;
    
    // Emit the message event
    this.emit('message', {
      clientId,
      message,
      timestamp: Date.now()
    });
    
    // Handle system messages
    if (type.startsWith('system.')) {
      this.handleSystemMessage(clientId, message);
      return;
    }
    
    // Check if we have handlers for this message type
    if (this.routes.has(type)) {
      const handlers = this.routes.get(type);
      
      // Execute all handlers
      handlers.forEach((handler) => {
        try {
          handler(clientId, message);
        } catch (error) {
          this.emit('error', { clientId, message, error });
        }
      });
    } else {
      // No handlers found for this message type
      this.emit('unhandled', { clientId, message });
    }
  }
  
  /**
   * Handle system messages
   */
  handleSystemMessage(clientId, message) {
    const { type, data } = message;
    
    switch (type) {
      case 'system.ping':
        // Handle ping message
        this.emit('response', {
          clientId,
          message: {
            type: 'system.pong',
            data: { timestamp: Date.now() }
          }
        });
        break;
        
      case 'system.register':
        // Handle client registration
        this.emit('register', {
          clientId,
          data
        });
        break;
        
      default:
        // Unknown system message
        this.emit('unhandled', { clientId, message });
        break;
    }
  }
}

module.exports = { MessageRouter };
