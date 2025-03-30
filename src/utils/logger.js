/**
 * Logger utility for Claude UI MCP Server
 * Provides consistent logging functionality across the application
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.logToConsole = options.console !== false;
    this.logToFile = options.file !== false;
    this.logDir = options.logDir || path.join(process.cwd(), 'logs');
    this.filename = options.filename || 'mcp-server.log';
    this.maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB
    this.maxFiles = options.maxFiles || 5;
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    // Create logs directory if it doesn't exist
    if (this.logToFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Check for log rotation
    if (this.logToFile) {
      this.rotateLogsIfNeeded();
    }
  }
  
  /**
   * Check if the log file needs to be rotated
   */
  rotateLogsIfNeeded() {
    const logPath = path.join(this.logDir, this.filename);
    
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      
      if (stats.size >= this.maxSize) {
        this.rotateLogFiles();
      }
    }
  }
  
  /**
   * Rotate log files
   */
  rotateLogFiles() {
    for (let i = this.maxFiles - 1; i > 0; i--) {
      const oldPath = path.join(this.logDir, `${this.filename}.${i}`);
      const newPath = path.join(this.logDir, `${this.filename}.${i + 1}`);
      
      if (fs.existsSync(oldPath)) {
        if (i === this.maxFiles - 1) {
          fs.unlinkSync(oldPath);
        } else {
          fs.renameSync(oldPath, newPath);
        }
      }
    }
    
    const logPath = path.join(this.logDir, this.filename);
    const rotatedPath = path.join(this.logDir, `${this.filename}.1`);
    
    if (fs.existsSync(logPath)) {
      fs.renameSync(logPath, rotatedPath);
    }
  }
  
  /**
   * Format a log message
   */
  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    let formattedMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        formattedMessage += '\n' + util.inspect(data, { depth: null, colors: false });
      } else {
        formattedMessage += ' ' + data;
      }
    }
    
    return formattedMessage;
  }
  
  /**
   * Write a log message
   */
  log(level, message, data) {
    const levelValue = this.levels[level];
    const currentLevelValue = this.levels[this.level];
    
    if (!levelValue || levelValue > currentLevelValue) {
      return;
    }
    
    const formattedMessage = this.formatMessage(level, message, data);
    
    // Log to console
    if (this.logToConsole) {
      if (level === 'error') {
        console.error(formattedMessage);
      } else if (level === 'warn') {
        console.warn(formattedMessage);
      } else {
        console.log(formattedMessage);
      }
    }
    
    // Log to file
    if (this.logToFile) {
      const logPath = path.join(this.logDir, this.filename);
      fs.appendFileSync(logPath, formattedMessage + '\n');
      
      // Check for log rotation after write
      this.rotateLogsIfNeeded();
    }
  }
  
  /**
   * Log an error message
   */
  error(message, data) {
    this.log('error', message, data);
  }
  
  /**
   * Log a warning message
   */
  warn(message, data) {
    this.log('warn', message, data);
  }
  
  /**
   * Log an info message
   */
  info(message, data) {
    this.log('info', message, data);
  }
  
  /**
   * Log a debug message
   */
  debug(message, data) {
    this.log('debug', message, data);
  }
}

// Create a default logger instance
const defaultLogger = new Logger();

module.exports = {
  Logger,
  logger: defaultLogger
};
