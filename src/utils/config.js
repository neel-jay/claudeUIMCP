/**
 * Configuration utility for Claude UI MCP Server
 * Manages application settings and provides defaults
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { logger } = require('./logger');

// Default configuration
const DEFAULT_CONFIG = {
  server: {
    port: 3030,
    host: 'localhost',
    autoStart: false,
    maxConnections: 50,
    idleTimeout: 300000, // 5 minutes
    pingInterval: 30000, // 30 seconds
  },
  security: {
    enabled: false,
    authRequired: false,
    tokenExpiration: 86400000, // 24 hours
    allowedOrigins: ['*'],
    authProvider: 'local',
  },
  api: {
    claude: {
      enabled: true,
      apiKey: '',
      modelName: 'claude-3-opus-20240229',
      timeout: 60000, // 1 minute
      maxResponseTokens: 4096,
    },
    anthropic: {
      enabled: false,
      apiKey: '',
      baseUrl: 'https://api.anthropic.com',
      version: '2023-06-01',
    },
  },
  logging: {
    level: 'info',
    console: true,
    file: true,
    logDir: path.join(os.homedir(), '.claude-ui-mcp', 'logs'),
  },
  ui: {
    theme: 'system',
    fontSize: 'medium',
    startInTray: false,
    minimizeToTray: true,
    startMinimized: false,
  },
  advanced: {
    debugMode: false,
    enableDevTools: false,
    customMessages: {},
  }
};

class ConfigManager {
  constructor(options = {}) {
    this.configPath = options.configPath || path.join(os.homedir(), '.claude-ui-mcp', 'config.json');
    this.config = Object.assign({}, DEFAULT_CONFIG);
    this.loaded = false;
    
    // Create config directory if it doesn't exist
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Load configuration
    this.load();
  }
  
  /**
   * Load configuration from file
   */
  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        
        // Deep merge configuration
        this.config = this.mergeConfigs(this.config, fileConfig);
        this.loaded = true;
        
        logger.info('Configuration loaded successfully');
      } else {
        // If config file doesn't exist, create it with defaults
        this.save();
        logger.info('Created default configuration file');
      }
    } catch (error) {
      logger.error('Error loading configuration', error);
    }
    
    return this.config;
  }
  
  /**
   * Save configuration to file
   */
  save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      logger.info('Configuration saved successfully');
      return true;
    } catch (error) {
      logger.error('Error saving configuration', error);
      return false;
    }
  }
  
  /**
   * Get a configuration value by path
   */
  get(path, defaultValue) {
    if (!path) {
      return this.config;
    }
    
    const parts = path.split('.');
    let current = this.config;
    
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return defaultValue;
      }
      
      current = current[part];
      
      if (current === undefined) {
        return defaultValue;
      }
    }
    
    return current;
  }
  
  /**
   * Set a configuration value by path
   */
  set(path, value) {
    if (!path) {
      return false;
    }
    
    const parts = path.split('.');
    let current = this.config;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      
      if (current[part] === undefined) {
        current[part] = {};
      }
      
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
    return true;
  }
  
  /**
   * Update multiple configuration values
   */
  update(updates) {
    if (!updates || typeof updates !== 'object') {
      return false;
    }
    
    // Deep merge updates
    this.config = this.mergeConfigs(this.config, updates);
    
    // Save updated configuration
    return this.save();
  }
  
  /**
   * Reset configuration to defaults
   */
  reset() {
    this.config = Object.assign({}, DEFAULT_CONFIG);
    return this.save();
  }
  
  /**
   * Deep merge two configuration objects
   */
  mergeConfigs(target, source) {
    const merged = Object.assign({}, target);
    
    if (source && typeof source === 'object') {
      Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];
        
        if (targetValue && typeof targetValue === 'object' && 
            sourceValue && typeof sourceValue === 'object') {
          merged[key] = this.mergeConfigs(targetValue, sourceValue);
        } else if (sourceValue !== undefined) {
          merged[key] = sourceValue;
        }
      });
    }
    
    return merged;
  }
}

// Create a default configuration manager
const configManager = new ConfigManager();

module.exports = {
  ConfigManager,
  configManager,
  DEFAULT_CONFIG
};
