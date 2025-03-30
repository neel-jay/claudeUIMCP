import React, { useState, useEffect } from 'react';

export const ConnectionsEnhanced = () => {
  const [connections, setConnections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  
  useEffect(() => {
    loadConnections();
    
    // Set up connection update listener
    if (window.electron) {
      const unsubscribe = window.electron.onConnectionUpdate((data) => {
        if (data.type === 'new') {
          setConnections(prevConnections => [...prevConnections, data.connection]);
        } else if (data.type === 'closed') {
          setConnections(prevConnections => 
            prevConnections.filter(conn => conn.id !== data.connectionId)
          );
          
          // Clear selected connection if it was the one closed
          if (selectedConnection && selectedConnection.id === data.connectionId) {
            setSelectedConnection(null);
          }
        } else if (data.type === 'update' && data.connection) {
          setConnections(prevConnections => 
            prevConnections.map(conn => 
              conn.id === data.connection.id ? data.connection : conn
            )
          );
          
          // Update selected connection if it was the one updated
          if (selectedConnection && selectedConnection.id === data.connection.id) {
            setSelectedConnection(data.connection);
          }
        }
      });
      
      // Poll for updated connections every 5 seconds
      const intervalId = setInterval(() => {
        loadConnections(false);
      }, 5000);
      
      return () => {
        unsubscribe();
        clearInterval(intervalId);
      };
    }
  }, [selectedConnection]);
  
  const loadConnections = async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    
    try {
      if (window.electron) {
        const connectionsList = await window.electron.getConnections();
        setConnections(connectionsList);
      } else {
        // Mock data for development
        setConnections([
          {
            id: '1234-5678-90ab-cdef',
            ipAddress: '192.168.1.100',
            connected: Date.now() - 3600000, // 1 hour ago
            lastActivity: Date.now() - 60000, // 1 minute ago
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            clientInfo: { type: 'browser', name: 'Chrome' },
            stats: { messagesReceived: 24, messagesSent: 18, errors: 0 },
            isAuthenticated: true
          },
          {
            id: '2345-6789-01bc-def0',
            ipAddress: '192.168.1.101',
            connected: Date.now() - 1800000, // 30 minutes ago
            lastActivity: Date.now() - 300000, // 5 minutes ago
            userAgent: 'MCP Client/1.0',
            clientInfo: { type: 'app', name: 'MCP Client' },
            stats: { messagesReceived: 12, messagesSent: 8, errors: 1 },
            isAuthenticated: true
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };
  
  const disconnectClient = async (clientId) => {
    setActionResult(null);
    
    try {
      if (window.electron) {
        const result = await window.electron.disconnectClient(clientId);
        
        if (result.success) {
          // Remove from local state (the listener should also handle this)
          setConnections(connections.filter(conn => conn.id !== clientId));
          
          if (selectedConnection && selectedConnection.id === clientId) {
            setSelectedConnection(null);
          }
          
          setActionResult({
            success: true,
            message: 'Client disconnected successfully'
          });
        } else {
          setActionResult({
            success: false,
            message: result.error || 'Failed to disconnect client'
          });
        }
      } else {
        // Mock for development
        setConnections(connections.filter(conn => conn.id !== clientId));
        
        if (selectedConnection && selectedConnection.id === clientId) {
          setSelectedConnection(null);
        }
        
        setActionResult({
          success: true,
          message: 'Client disconnected successfully'
        });
      }
    } catch (error) {
      setActionResult({
        success: false,
        message: 'Error disconnecting client: ' + error.message
      });
    }
  };
  
  const selectConnection = (connection) => {
    setSelectedConnection(connection === selectedConnection ? null : connection);
  };
  
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  const formatDuration = (timestamp) => {
    const now = Date.now();
    const diffSeconds = Math.floor((now - timestamp) / 1000);
    
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    }
    
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };
  
  return (
    <div className="connections">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Active Connections</h2>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => loadConnections()}
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
        <div className="card-content">
          {actionResult && (
            <div className={`mt-2 mb-3 ${actionResult.success ? 'text-success' : 'text-danger'}`}>
              {actionResult.message}
            </div>
          )}
          
          {isLoading ? (
            <div>Loading connections...</div>
          ) : connections.length === 0 ? (
            <div>No active connections</div>
          ) : (
            <div className="connections-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>IP Address</th>
                    <th>Connected</th>
                    <th>Last Activity</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {connections.map((connection) => (
                    <tr 
                      key={connection.id} 
                      className={selectedConnection && selectedConnection.id === connection.id ? 'active' : ''}
                      onClick={() => selectConnection(connection)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        {connection.clientInfo && connection.clientInfo.name 
                          ? connection.clientInfo.name 
                          : 'Unknown Client'}
                      </td>
                      <td>{connection.ipAddress || connection.ip}</td>
                      <td title={formatTime(connection.connected)}>
                        {formatDuration(connection.connected)}
                      </td>
                      <td title={formatTime(connection.lastActivity)}>
                        {formatDuration(connection.lastActivity)}
                      </td>
                      <td>
                        <span className={`status-indicator status-${connection.isAuthenticated ? 'success' : 'warning'}`}>
                          {connection.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            disconnectClient(connection.id);
                          }}
                        >
                          Disconnect
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
      
      {selectedConnection && (
        <div className="card mt-3">
          <div className="card-header">
            <h2 className="card-title">Connection Details</h2>
          </div>
          <div className="card-content">
            <div className="connection-details">
              <div className="mb-3">
                <h4>Client Information</h4>
                <div className="detail-row">
                  <span className="detail-label">ID:</span>
                  <span className="detail-value">{selectedConnection.id}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">IP Address:</span>
                  <span className="detail-value">{selectedConnection.ipAddress || selectedConnection.ip}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">User Agent:</span>
                  <span className="detail-value">{selectedConnection.userAgent || 'Unknown'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Connected:</span>
                  <span className="detail-value">{formatTime(selectedConnection.connected)} ({formatDuration(selectedConnection.connected)})</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Last Activity:</span>
                  <span className="detail-value">{formatTime(selectedConnection.lastActivity)} ({formatDuration(selectedConnection.lastActivity)})</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Authentication:</span>
                  <span className={`detail-value ${selectedConnection.isAuthenticated ? 'text-success' : 'text-warning'}`}>
                    {selectedConnection.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                  </span>
                </div>
              </div>
              
              {selectedConnection.stats && (
                <div className="mb-3">
                  <h4>Statistics</h4>
                  <div className="detail-row">
                    <span className="detail-label">Messages Received:</span>
                    <span className="detail-value">{selectedConnection.stats.messagesReceived}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Messages Sent:</span>
                    <span className="detail-value">{selectedConnection.stats.messagesSent}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Errors:</span>
                    <span className="detail-value">{selectedConnection.stats.errors}</span>
                  </div>
                </div>
              )}
              
              {selectedConnection.clientInfo && Object.keys(selectedConnection.clientInfo).length > 0 && (
                <div>
                  <h4>Client Details</h4>
                  {Object.entries(selectedConnection.clientInfo).map(([key, value]) => (
                    <div className="detail-row" key={key}>
                      <span className="detail-label">{key}:</span>
                      <span className="detail-value">
                        {typeof value === 'object' ? JSON.stringify(value) : value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
