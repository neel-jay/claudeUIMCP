import React, { useState, useEffect } from 'react';

export const Settings = ({ serverStatus }) => {
  const [config, setConfig] = useState({
    port: 3030,
    host: 'localhost',
    autoStart: false,
    logging: {
      level: 'info',
      console: true,
      file: true
    }
  });
  
  const [saved, setSaved] = useState(false);
  
  useEffect(() => {
    // Load current configuration
    if (serverStatus.config) {
      setConfig(prev => ({
        ...prev,
        port: serverStatus.config.port || prev.port,
        host: serverStatus.config.host || prev.host,
      }));
    }
    
    // Set up config saved listener
    if (window.electron) {
      const unsubscribe = window.electron.onConfigSaved(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      });
      
      return unsubscribe;
    }
  }, [serverStatus.config]);
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      // Handle nested properties
      const [parent, child] = name.split('.');
      setConfig(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      // Handle top-level properties
      setConfig(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };
  
  const handleNumberInput = (e) => {
    const { name, value } = e.target;
    const numValue = parseInt(value, 10);
    
    if (!isNaN(numValue)) {
      setConfig(prev => ({
        ...prev,
        [name]: numValue
      }));
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (window.electron) {
      window.electron.saveConfig(config);
    }
  };
  
  return (
    <div className="settings">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Server Settings</h2>
        </div>
        <div className="card-content">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="host">Host</label>
              <input
                id="host"
                name="host"
                type="text"
                className="form-control"
                value={config.host}
                onChange={handleInputChange}
                disabled={serverStatus.status === 'running'}
              />
              {serverStatus.status === 'running' && (
                <div className="text-muted mt-1">
                  Stop the server to change the host
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="port">Port</label>
              <input
                id="port"
                name="port"
                type="number"
                className="form-control"
                value={config.port}
                onChange={handleNumberInput}
                min="1024"
                max="65535"
                disabled={serverStatus.status === 'running'}
              />
              {serverStatus.status === 'running' && (
                <div className="text-muted mt-1">
                  Stop the server to change the port
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label className="form-label">
                <input
                  type="checkbox"
                  name="autoStart"
                  checked={config.autoStart}
                  onChange={handleInputChange}
                />
                <span className="ml-2">Auto-start server on application launch</span>
              </label>
            </div>
            
            <div className="form-group">
              <label className="form-label">Logging Level</label>
              <select
                name="logging.level"
                className="form-control"
                value={config.logging.level}
                onChange={handleInputChange}
              >
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Information</option>
                <option value="debug">Debug</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">
                <input
                  type="checkbox"
                  name="logging.console"
                  checked={config.logging.console}
                  onChange={handleInputChange}
                />
                <span className="ml-2">Console Logging</span>
              </label>
            </div>
            
            <div className="form-group">
              <label className="form-label">
                <input
                  type="checkbox"
                  name="logging.file"
                  checked={config.logging.file}
                  onChange={handleInputChange}
                />
                <span className="ml-2">File Logging</span>
              </label>
            </div>
            
            <div className="form-group">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={serverStatus.status === 'unknown'}
              >
                Save Settings
              </button>
              
              {saved && (
                <span className="text-success ml-3">
                  Settings saved successfully!
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
