/**
 * Plugin Manager for Claude UI MCP Server
 * Provides support for loading and managing plugins
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { logger } = require('./logger');
const { configManager } = require('./config');

class PluginManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.plugins = new Map();
    this.pluginsDirectory = options.pluginsDirectory || path.join(process.cwd(), 'plugins');
    this.enabledPlugins = options.enabledPlugins || configManager.get('plugins.enabled', []);
    
    // Create plugins directory if it doesn't exist
    if (!fs.existsSync(this.pluginsDirectory)) {
      fs.mkdirSync(this.pluginsDirectory, { recursive: true });
    }
  }
  
  /**
   * Load all enabled plugins
   */
  async loadPlugins() {
    logger.info('Loading plugins...');
    
    // Get all plugin directories
    let pluginDirs = [];
    
    try {
      pluginDirs = fs.readdirSync(this.pluginsDirectory)
        .filter(item => {
          const itemPath = path.join(this.pluginsDirectory, item);
          return fs.statSync(itemPath).isDirectory();
        });
    } catch (error) {
      logger.error('Error reading plugins directory', error);
      return [];
    }
    
    const loadedPlugins = [];
    
    // Load each enabled plugin
    for (const pluginDir of pluginDirs) {
      const pluginName = pluginDir;
      
      // Skip disabled plugins
      if (!this.enabledPlugins.includes(pluginName) && this.enabledPlugins.length > 0) {
        logger.debug(`Skipping disabled plugin: ${pluginName}`);
        continue;
      }
      
      try {
        const plugin = await this.loadPlugin(pluginName);
        
        if (plugin) {
          loadedPlugins.push(plugin);
        }
      } catch (error) {
        logger.error(`Error loading plugin ${pluginName}`, error);
      }
    }
    
    logger.info(`Loaded ${loadedPlugins.length} plugins`);
    return loadedPlugins;
  }
  
  /**
   * Load a specific plugin
   */
  async loadPlugin(pluginName) {
    const pluginPath = path.join(this.pluginsDirectory, pluginName);
    const pluginIndexPath = path.join(pluginPath, 'index.js');
    
    // Check if plugin exists
    if (!fs.existsSync(pluginIndexPath)) {
      logger.warn(`Plugin index file not found: ${pluginIndexPath}`);
      return null;
    }
    
    try {
      // Load plugin manifest
      const manifestPath = path.join(pluginPath, 'manifest.json');
      let manifest = {};
      
      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } else {
        logger.warn(`Plugin manifest not found: ${manifestPath}`);
      }
      
      // Validate manifest
      if (!manifest.name) {
        manifest.name = pluginName;
      }
      
      if (!manifest.version) {
        manifest.version = '0.1.0';
      }
      
      // Load plugin module
      const pluginModule = require(pluginIndexPath);
      
      // Check if plugin has initialize method
      if (typeof pluginModule.initialize !== 'function') {
        logger.warn(`Plugin ${pluginName} does not have initialize method`);
        return null;
      }
      
      // Create plugin instance
      const plugin = {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description || '',
        author: manifest.author || '',
        module: pluginModule,
        path: pluginPath,
        enabled: true
      };
      
      // Initialize plugin
      await pluginModule.initialize({
        logger,
        config: configManager,
        pluginManager: this
      });
      
      // Register plugin
      this.plugins.set(plugin.name, plugin);
      
      logger.info(`Loaded plugin: ${plugin.name} v${plugin.version}`);
      this.emit('pluginLoaded', plugin);
      
      return plugin;
    } catch (error) {
      logger.error(`Failed to load plugin ${pluginName}`, error);
      throw error;
    }
  }
  
  /**
   * Unload a specific plugin
   */
  async unloadPlugin(pluginName) {
    if (!this.plugins.has(pluginName)) {
      logger.warn(`Plugin not loaded: ${pluginName}`);
      return false;
    }
    
    const plugin = this.plugins.get(pluginName);
    
    try {
      // Call the plugin's shutdown method if available
      if (plugin.module.shutdown && typeof plugin.module.shutdown === 'function') {
        await plugin.module.shutdown();
      }
      
      // Remove plugin from the registry
      this.plugins.delete(pluginName);
      
      // Clear the module from the Node.js require cache
      const pluginIndexPath = path.join(plugin.path, 'index.js');
      delete require.cache[require.resolve(pluginIndexPath)];
      
      logger.info(`Unloaded plugin: ${pluginName}`);
      this.emit('pluginUnloaded', { name: pluginName });
      
      return true;
    } catch (error) {
      logger.error(`Failed to unload plugin ${pluginName}`, error);
      return false;
    }
  }
  
  /**
   * Get a list of all loaded plugins
   */
  getPlugins() {
    const pluginList = [];
    
    for (const [name, plugin] of this.plugins.entries()) {
      pluginList.push({
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        enabled: plugin.enabled
      });
    }
    
    return pluginList;
  }
  
  /**
   * Enable a specific plugin
   */
  enablePlugin(pluginName) {
    if (!this.plugins.has(pluginName)) {
      logger.warn(`Plugin not loaded: ${pluginName}`);
      return false;
    }
    
    const plugin = this.plugins.get(pluginName);
    plugin.enabled = true;
    
    // Update enabled plugins list
    if (!this.enabledPlugins.includes(pluginName)) {
      this.enabledPlugins.push(pluginName);
      configManager.set('plugins.enabled', this.enabledPlugins);
      configManager.save();
    }
    
    logger.info(`Enabled plugin: ${pluginName}`);
    this.emit('pluginEnabled', { name: pluginName });
    
    return true;
  }
  
  /**
   * Disable a specific plugin
   */
  disablePlugin(pluginName) {
    if (!this.plugins.has(pluginName)) {
      logger.warn(`Plugin not loaded: ${pluginName}`);
      return false;
    }
    
    const plugin = this.plugins.get(pluginName);
    plugin.enabled = false;
    
    // Update enabled plugins list
    const index = this.enabledPlugins.indexOf(pluginName);
    if (index !== -1) {
      this.enabledPlugins.splice(index, 1);
      configManager.set('plugins.enabled', this.enabledPlugins);
      configManager.save();
    }
    
    logger.info(`Disabled plugin: ${pluginName}`);
    this.emit('pluginDisabled', { name: pluginName });
    
    return true;
  }
  
  /**
   * Call a method on all enabled plugins
   */
  async callPluginMethod(methodName, ...args) {
    const results = [];
    
    for (const [name, plugin] of this.plugins.entries()) {
      if (plugin.enabled && plugin.module[methodName] && typeof plugin.module[methodName] === 'function') {
        try {
          const result = await plugin.module[methodName](...args);
          results.push({ name, result });
        } catch (error) {
          logger.error(`Error calling ${methodName} on plugin ${name}`, error);
          results.push({ name, error });
        }
      }
    }
    
    return results;
  }
  
  /**
   * Install a new plugin from a directory
   */
  async installPlugin(sourcePath) {
    try {
      // Check if source directory exists
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source path does not exist: ${sourcePath}`);
      }
      
      // Check for manifest file
      const manifestPath = path.join(sourcePath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Plugin manifest not found: ${manifestPath}`);
      }
      
      // Read manifest
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // Validate manifest
      if (!manifest.name) {
        throw new Error('Plugin manifest must include a name');
      }
      
      const pluginName = manifest.name;
      const targetPath = path.join(this.pluginsDirectory, pluginName);
      
      // Check if plugin already exists
      if (fs.existsSync(targetPath)) {
        throw new Error(`Plugin already exists: ${pluginName}`);
      }
      
      // Copy plugin files
      fs.mkdirSync(targetPath, { recursive: true });
      this.copyDirectory(sourcePath, targetPath);
      
      logger.info(`Installed plugin: ${pluginName}`);
      this.emit('pluginInstalled', { name: pluginName });
      
      // Load the plugin
      return await this.loadPlugin(pluginName);
    } catch (error) {
      logger.error('Failed to install plugin', error);
      throw error;
    }
  }
  
  /**
   * Helper method to copy a directory recursively
   */
  copyDirectory(source, target) {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    
    // Copy all files and subdirectories
    const items = fs.readdirSync(source);
    
    for (const item of items) {
      const sourcePath = path.join(source, item);
      const targetPath = path.join(target, item);
      
      const stats = fs.statSync(sourcePath);
      
      if (stats.isDirectory()) {
        this.copyDirectory(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }
}

// Create a singleton instance
const pluginManager = new PluginManager();

module.exports = {
  PluginManager,
  pluginManager
};
