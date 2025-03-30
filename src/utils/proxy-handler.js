/**
 * Proxy Handler for Claude UI MCP Server
 * Provides functionality to proxy requests to external services
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { logger } = require('./logger');
const { configManager } = require('./config');

class ProxyHandler {
  constructor(options = {}) {
    this.routes = new Map();
    this.defaultTimeout = options.timeout || 30000; // 30 seconds
    
    // Register default routes
    this.registerDefaultRoutes();
  }
  
  /**
   * Register default proxy routes
   */
  registerDefaultRoutes() {
    // Register a mock AI service endpoint
    this.registerRoute('mock-ai', {
      baseUrl: 'https://httpbin.org',
      endpoints: {
        '/complete': '/anything',
        '/models': '/json'
      },
      timeout: 5000
    });
  }
  
  /**
   * Register a new proxy route
   */
  registerRoute(name, config) {
    if (!name || !config || !config.baseUrl) {
      throw new Error('Invalid route configuration');
    }
    
    this.routes.set(name, {
      baseUrl: config.baseUrl,
      endpoints: config.endpoints || {},
      headers: config.headers || {},
      timeout: config.timeout || this.defaultTimeout,
      authHandler: config.authHandler || null
    });
    
    logger.info(`Registered proxy route: ${name}`);
  }
  
  /**
   * Unregister a proxy route
   */
  unregisterRoute(name) {
    const removed = this.routes.delete(name);
    
    if (removed) {
      logger.info(`Unregistered proxy route: ${name}`);
    }
    
    return removed;
  }
  
  /**
   * Forward a request to the specified route
   */
  async forwardRequest(routeName, endpoint, method, data, headers = {}) {
    if (!this.routes.has(routeName)) {
      throw new Error(`Unknown proxy route: ${routeName}`);
    }
    
    const route = this.routes.get(routeName);
    
    // Resolve the actual endpoint URL
    let targetEndpoint = endpoint;
    if (route.endpoints[endpoint]) {
      targetEndpoint = route.endpoints[endpoint];
    }
    
    // Construct the full URL
    const url = new URL(targetEndpoint, route.baseUrl);
    
    // Merge headers
    const mergedHeaders = {
      'Content-Type': 'application/json',
      ...route.headers,
      ...headers
    };
    
    // Call auth handler if provided
    if (route.authHandler && typeof route.authHandler === 'function') {
      const authHeaders = await route.authHandler(routeName, endpoint);
      Object.assign(mergedHeaders, authHeaders);
    }
    
    // Make the request
    return this.makeRequest(url.toString(), method, data, mergedHeaders, route.timeout);
  }
  
  /**
   * Make an HTTP request
   */
  async makeRequest(url, method, data, headers, timeout) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const options = {
        method: method || 'GET',
        headers: headers || {},
        timeout: timeout || this.defaultTimeout
      };
      
      const req = httpModule.request(url, options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            // Try to parse as JSON
            let parsedData;
            try {
              parsedData = JSON.parse(responseData);
            } catch (e) {
              parsedData = responseData;
            }
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                status: res.statusCode,
                headers: res.headers,
                data: parsedData
              });
            } else {
              reject({
                status: res.statusCode,
                headers: res.headers,
                error: 'Request failed',
                data: parsedData
              });
            }
          } catch (error) {
            reject({
              status: 500,
              error: 'Error processing response',
              message: error.message,
              data: responseData
            });
          }
        });
      });
      
      req.on('error', (error) => {
        reject({
          status: 500,
          error: 'Request error',
          message: error.message
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject({
          status: 408,
          error: 'Request timeout',
          message: `Request timed out after ${timeout}ms`
        });
      });
      
      if (data) {
        const requestData = typeof data === 'string' ? data : JSON.stringify(data);
        req.write(requestData);
      }
      
      req.end();
    });
  }
}

// Create a singleton instance
const proxyHandler = new ProxyHandler();

module.exports = {
  ProxyHandler,
  proxyHandler
};
