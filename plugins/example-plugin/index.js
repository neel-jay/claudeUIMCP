/**
 * Example Plugin for Claude UI MCP Server
 * Demonstrates how to create a simple plugin
 */

// Plugin context object that will be populated by the plugin manager
let context = {
  logger: null,
  config: null,
  pluginManager: null
};

/**
 * Initialize the plugin
 * This is called by the plugin manager when the plugin is loaded
 */
function initialize(ctx) {
  // Store the plugin context
  context = ctx;
  
  // Log that we've been initialized
  context.logger.info('Example plugin initialized');
  
  return Promise.resolve();
}

/**
 * Handle a message
 * Return true if the message was handled, false otherwise
 */
function handleMessage(message, serverContext) {
  // Only handle messages of a specific type
  if (message.type === 'example.echo') {
    // Get the connection ID from the server context
    const { connectionId, server } = serverContext;
    
    // Log that we're handling the message
    context.logger.info(`Example plugin handling message from ${connectionId}`);
    
    // Send a response back to the client
    server.connectionManager.sendMessage(connectionId, 'example.echo.response', {
      echo: message.data,
      handled_by: 'example-plugin',
      timestamp: Date.now()
    });
    
    // Return true to indicate we handled the message
    return true;
  }
  
  // Return false to indicate we didn't handle the message
  return false;
}

/**
 * Server shutdown handler
 * This is called when the server is shutting down
 */
function onServerShutdown() {
  context.logger.info('Example plugin shutting down');
  return Promise.resolve();
}

// Export the plugin API
module.exports = {
  initialize,
  handleMessage,
  onServerShutdown
};
