/**
 * Anthropic API integration for Claude UI MCP Server
 * Provides methods to interact with Claude and other Anthropic models
 */

const https = require('https');
const { logger } = require('./logger');
const { configManager } = require('./config');

class AnthropicAPI {
  constructor(options = {}) {
    this.apiKey = options.apiKey || configManager.get('api.anthropic.apiKey', '');
    this.baseUrl = options.baseUrl || configManager.get('api.anthropic.baseUrl', 'https://api.anthropic.com');
    this.apiVersion = options.apiVersion || configManager.get('api.anthropic.version', '2023-06-01');
    this.defaultModel = options.defaultModel || configManager.get('api.claude.modelName', 'claude-3-opus-20240229');
    this.timeout = options.timeout || configManager.get('api.claude.timeout', 60000);
    
    // Validate API key
    if (!this.apiKey) {
      logger.warn('No Anthropic API key provided. API calls will fail.');
    }
  }
  
  /**
   * Make a request to the Anthropic API
   */
  async makeRequest(endpoint, method, data) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'anthropic-version': this.apiVersion
        },
        timeout: this.timeout
      };
      
      const req = https.request(url, options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const jsonResponse = JSON.parse(responseData);
              resolve(jsonResponse);
            } else {
              let errorData;
              try {
                errorData = JSON.parse(responseData);
              } catch (e) {
                errorData = { error: responseData };
              }
              
              reject({
                statusCode: res.statusCode,
                message: `API request failed with status ${res.statusCode}`,
                data: errorData
              });
            }
          } catch (error) {
            reject({
              statusCode: 500,
              message: 'Error parsing API response',
              error: error.message,
              data: responseData
            });
          }
        });
      });
      
      req.on('error', (error) => {
        reject({
          statusCode: 500,
          message: 'Network error',
          error: error.message
        });
      });
      
      req.on('timeout', () => {
        req.abort();
        reject({
          statusCode: 408,
          message: `Request timeout after ${this.timeout}ms`
        });
      });
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }
  
  /**
   * Send a query to Claude model
   */
  async query(messages, options = {}) {
    try {
      const model = options.model || this.defaultModel;
      const maxTokens = options.maxTokens || configManager.get('api.claude.maxResponseTokens', 4096);
      const temperature = options.temperature !== undefined ? options.temperature : 0.7;
      const system = options.system || '';
      
      // Build messages in the format expected by Anthropic
      const formattedMessages = messages.map(message => ({
        role: message.role,
        content: message.content
      }));
      
      const requestData = {
        model,
        messages: formattedMessages,
        max_tokens: maxTokens,
        temperature,
      };
      
      if (system) {
        requestData.system = system;
      }
      
      const response = await this.makeRequest('/v1/messages', 'POST', requestData);
      return response;
    } catch (error) {
      logger.error('Error querying Claude', error);
      throw error;
    }
  }
  
  /**
   * Stream a response from Claude
   */
  async streamResponse(messages, callbacks, options = {}) {
    try {
      const model = options.model || this.defaultModel;
      const maxTokens = options.maxTokens || configManager.get('api.claude.maxResponseTokens', 4096);
      const temperature = options.temperature !== undefined ? options.temperature : 0.7;
      const system = options.system || '';
      
      // Build messages in the format expected by Anthropic
      const formattedMessages = messages.map(message => ({
        role: message.role,
        content: message.content
      }));
      
      const requestData = {
        model,
        messages: formattedMessages,
        max_tokens: maxTokens,
        temperature,
        stream: true
      };
      
      if (system) {
        requestData.system = system;
      }
      
      const url = new URL('/v1/messages', this.baseUrl);
      
      const httpOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'anthropic-version': this.apiVersion
        },
        timeout: this.timeout
      };
      
      const req = https.request(url, httpOptions, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let errorData = '';
          
          res.on('data', (chunk) => {
            errorData += chunk;
          });
          
          res.on('end', () => {
            try {
              const parsedError = JSON.parse(errorData);
              if (callbacks.onError) {
                callbacks.onError({
                  statusCode: res.statusCode,
                  error: parsedError
                });
              }
            } catch (e) {
              if (callbacks.onError) {
                callbacks.onError({
                  statusCode: res.statusCode,
                  error: errorData
                });
              }
            }
          });
          
          return;
        }
        
        let buffer = '';
        
        // Signal stream start
        if (callbacks.onStart) {
          callbacks.onStart();
        }
        
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          
          // Process complete event data chunks
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim() === '') continue;
            
            // Remove "data: " prefix
            const data = line.replace(/^data: /, '');
            
            if (data === '[DONE]') {
              if (callbacks.onDone) {
                callbacks.onDone();
              }
              continue;
            }
            
            try {
              const parsedData = JSON.parse(data);
              
              if (callbacks.onContent && parsedData.delta && parsedData.delta.text) {
                callbacks.onContent(parsedData.delta.text);
              }
            } catch (e) {
              logger.error('Error parsing stream data', e);
              if (callbacks.onError) {
                callbacks.onError({
                  message: 'Error parsing stream data',
                  error: e,
                  data
                });
              }
            }
          }
        });
        
        res.on('end', () => {
          // Process any remaining data
          if (buffer.trim() !== '') {
            try {
              const data = buffer.replace(/^data: /, '');
              if (data !== '[DONE]') {
                const parsedData = JSON.parse(data);
                if (callbacks.onContent && parsedData.delta && parsedData.delta.text) {
                  callbacks.onContent(parsedData.delta.text);
                }
              }
            } catch (e) {
              // Ignore parsing errors at the end
            }
          }
          
          // Signal stream completion
          if (callbacks.onDone) {
            callbacks.onDone();
          }
        });
      });
      
      req.on('error', (error) => {
        if (callbacks.onError) {
          callbacks.onError({
            message: 'Network error',
            error: error.message
          });
        }
      });
      
      req.on('timeout', () => {
        req.abort();
        if (callbacks.onError) {
          callbacks.onError({
            message: `Request timeout after ${this.timeout}ms`
          });
        }
      });
      
      req.write(JSON.stringify(requestData));
      req.end();
    } catch (error) {
      logger.error('Error streaming response from Claude', error);
      if (callbacks.onError) {
        callbacks.onError(error);
      }
    }
  }
  
  /**
   * Get available models
   */
  async getModels() {
    try {
      const response = await this.makeRequest('/v1/models', 'GET');
      return response;
    } catch (error) {
      logger.error('Error fetching available models', error);
      throw error;
    }
  }
}

// Create a singleton instance
const anthropicApi = new AnthropicAPI();

module.exports = {
  AnthropicAPI,
  anthropicApi
};
