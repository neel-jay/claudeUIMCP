import React, { useState, useEffect } from 'react';

export const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({
    level: 'all',
    search: ''
  });
  
  useEffect(() => {
    loadLogs();
  }, []);
  
  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (window.electron) {
        const result = await window.electron.getLogs();
        if (result.success) {
          setLogs(result.logs);
        } else {
          setError(result.error || 'Unknown error loading logs');
        }
      } else {
        // Mock data for development
        setLogs([
          { timestamp: '2023-03-31T00:25:29.936Z', level: 'INFO', message: 'Loading plugins...' },
          { timestamp: '2023-03-31T00:25:29.937Z', level: 'INFO', message: 'Example plugin initialized' },
          { timestamp: '2023-03-31T00:25:29.937Z', level: 'INFO', message: 'Loaded plugin: example-plugin v0.1.0' },
          { timestamp: '2023-03-31T00:25:29.937Z', level: 'INFO', message: 'Loaded 1 plugins' },
          { timestamp: '2023-03-31T00:25:29.946Z', level: 'INFO', message: 'MCP Server started on localhost:3030' },
          { timestamp: '2023-03-31T00:25:37.163Z', level: 'INFO', message: 'Notifying plugins about shutdown...' },
          { timestamp: '2023-03-31T00:25:37.164Z', level: 'INFO', message: 'Example plugin shutting down' },
          { timestamp: '2023-03-31T00:25:37.164Z', level: 'INFO', message: 'MCP Server stopped' },
          { timestamp: '2023-03-31T00:26:29.936Z', level: 'DEBUG', message: 'Client connected: 123456' },
          { timestamp: '2023-03-31T00:26:30.936Z', level: 'ERROR', message: 'Failed to process message' }
        ]);
      }
    } catch (err) {
      setError('Failed to load logs: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter({ ...filter, [name]: value });
  };
  
  const getFilteredLogs = () => {
    return logs.filter(log => {
      // Filter by level
      if (filter.level !== 'all' && log.level.toLowerCase() !== filter.level.toLowerCase()) {
        return false;
      }
      
      // Filter by search term
      if (filter.search && !log.message.toLowerCase().includes(filter.search.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  };
  
  const getLogLevelClass = (level) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'text-danger';
      case 'warn':
        return 'text-warning';
      case 'debug':
        return 'text-info';
      default:
        return '';
    }
  };
  
  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (err) {
      return timestamp;
    }
  };
  
  const filteredLogs = getFilteredLogs();
  
  return (
    <div className="logs">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Server Logs</h2>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={loadLogs}
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
        <div className="card-content">
          <div className="log-filters mb-3">
            <div className="d-flex">
              <div className="form-group mr-3">
                <label className="form-label">Level</label>
                <select
                  className="form-control"
                  name="level"
                  value={filter.level}
                  onChange={handleFilterChange}
                >
                  <option value="all">All</option>
                  <option value="error">Error</option>
                  <option value="warn">Warning</option>
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Search</label>
                <input
                  type="text"
                  className="form-control"
                  name="search"
                  value={filter.search}
                  onChange={handleFilterChange}
                  placeholder="Filter messages..."
                />
              </div>
            </div>
          </div>
          
          {isLoading ? (
            <div>Loading logs...</div>
          ) : error ? (
            <div className="text-danger">{error}</div>
          ) : logs.length === 0 ? (
            <div>No logs available</div>
          ) : (
            <div className="log-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '15%' }}>Time</th>
                    <th style={{ width: '10%' }}>Level</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, index) => (
                    <tr key={index}>
                      <td>{formatTimestamp(log.timestamp)}</td>
                      <td className={getLogLevelClass(log.level)}>
                        {log.level}
                      </td>
                      <td>{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredLogs.length === 0 && (
                <div className="text-center mt-3">
                  No logs match the current filters
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
