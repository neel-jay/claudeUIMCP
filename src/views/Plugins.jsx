import React, { useState, useEffect } from 'react';

export const Plugins = () => {
  const [plugins, setPlugins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  
  useEffect(() => {
    loadPlugins();
  }, []);
  
  const loadPlugins = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (window.electron) {
        const pluginsList = await window.electron.getPlugins();
        setPlugins(pluginsList);
      } else {
        // Mock data for development
        setPlugins([
          {
            name: 'example-plugin',
            version: '0.1.0',
            description: 'An example plugin for Claude UI MCP Server',
            author: 'Claude AI',
            enabled: true
          },
          {
            name: 'message-logger',
            version: '0.2.1',
            description: 'Logs all messages passing through the server',
            author: 'Claude AI',
            enabled: false
          }
        ]);
      }
    } catch (err) {
      setError('Failed to load plugins: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const togglePlugin = async (pluginName, currentState) => {
    setActionResult(null);
    
    try {
      let result;
      
      if (window.electron) {
        if (currentState) {
          result = await window.electron.disablePlugin(pluginName);
        } else {
          result = await window.electron.enablePlugin(pluginName);
        }
        
        if (result.success) {
          // Update the local state
          setPlugins(plugins.map(plugin => 
            plugin.name === pluginName 
              ? { ...plugin, enabled: !currentState }
              : plugin
          ));
          
          setActionResult({
            success: true,
            message: `Plugin ${currentState ? 'disabled' : 'enabled'} successfully`
          });
        } else {
          setActionResult({
            success: false,
            message: result.error || 'Unknown error'
          });
        }
      } else {
        // Mock for development
        setPlugins(plugins.map(plugin => 
          plugin.name === pluginName 
            ? { ...plugin, enabled: !currentState }
            : plugin
        ));
        
        setActionResult({
          success: true,
          message: `Plugin ${currentState ? 'disabled' : 'enabled'} successfully`
        });
      }
    } catch (err) {
      setActionResult({
        success: false,
        message: 'Error toggling plugin: ' + err.message
      });
    }
  };
  
  return (
    <div className="plugins">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Installed Plugins</h2>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={loadPlugins}
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
        <div className="card-content">
          {isLoading ? (
            <div>Loading plugins...</div>
          ) : error ? (
            <div className="text-danger">{error}</div>
          ) : plugins.length === 0 ? (
            <div>No plugins installed</div>
          ) : (
            <div>
              {actionResult && (
                <div className={`mt-2 mb-3 ${actionResult.success ? 'text-success' : 'text-danger'}`}>
                  {actionResult.message}
                </div>
              )}
              
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Version</th>
                    <th>Description</th>
                    <th>Author</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plugins.map((plugin) => (
                    <tr key={plugin.name}>
                      <td>{plugin.name}</td>
                      <td>{plugin.version}</td>
                      <td>{plugin.description}</td>
                      <td>{plugin.author}</td>
                      <td>
                        <span className={plugin.enabled ? 'text-success' : 'text-muted'}>
                          {plugin.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${plugin.enabled ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => togglePlugin(plugin.name, plugin.enabled)}
                        >
                          {plugin.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      <div className="card mt-3">
        <div className="card-header">
          <h2 className="card-title">Plugin Information</h2>
        </div>
        <div className="card-content">
          <p>
            Plugins extend the functionality of the Claude UI MCP Server. They can add new message handlers,
            modify server behavior, or provide integrations with other services.
          </p>
          <p>
            To install a plugin, place it in the <code>plugins</code> directory and restart the server.
          </p>
        </div>
      </div>
    </div>
  );
};
