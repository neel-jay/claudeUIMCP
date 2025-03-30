import React, { useState, useEffect } from 'react';

export const Connections = () => {
  const [connections, setConnections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // In a real app, we would fetch connections from the server
    // and set up a listener for connection updates
    setIsLoading(true);
    
    // Simulate loading connections
    setTimeout(() => {
      setConnections([
        {
          id: '1234-5678-90ab-cdef',
          ip: '192.168.1.100',
          connected: Date.now() - 3600000, // 1 hour ago
          lastActivity: Date.now() - 60000, // 1 minute ago
          client: 'Browser',
          status: 'active'
        },
        {
          id: '2345-6789-01bc-def0',
          ip: '192.168.1.101',
          connected: Date.now() - 1800000, // 30 minutes ago
          lastActivity: Date.now() - 300000, // 5 minutes ago
          client: 'Mobile App',
          status: 'idle'
        }
      ]);
      setIsLoading(false);
    }, 1000);
    
    // Set up connection update listener
    if (window.electron) {
      const unsubscribe = window.electron.onConnectionUpdate((data) => {
        setConnections(data.connections);
      });
      
      return unsubscribe;
    }
  }, []);
  
  const disconnectClient = (clientId) => {
    if (window.electron) {
      window.electron.disconnectClient(clientId);
    }
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
        </div>
        <div className="card-content">
          {isLoading ? (
            <div>Loading connections...</div>
          ) : connections.length === 0 ? (
            <div>No active connections</div>
          ) : (
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
                  <tr key={connection.id}>
                    <td>{connection.client || 'Unknown'}</td>
                    <td>{connection.ip}</td>
                    <td title={formatTime(connection.connected)}>
                      {formatDuration(connection.connected)}
                    </td>
                    <td title={formatTime(connection.lastActivity)}>
                      {formatDuration(connection.lastActivity)}
                    </td>
                    <td>
                      <span className={`status-${connection.status}`}>
                        {connection.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => disconnectClient(connection.id)}
                      >
                        Disconnect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
