import React from 'react';

export const Header = ({ serverStatus }) => {
  const getStatusText = () => {
    switch (serverStatus.status) {
      case 'running':
        return 'Server Running';
      case 'stopped':
        return 'Server Stopped';
      case 'error':
        return 'Server Error';
      default:
        return 'Loading Status...';
    }
  };

  const getStatusClass = () => {
    switch (serverStatus.status) {
      case 'running':
        return 'status-running';
      case 'stopped':
        return 'status-stopped';
      case 'error':
        return 'status-error';
      default:
        return '';
    }
  };

  return (
    <header className="header">
      <h1>Claude UI MCP Server</h1>
      <div className="server-status">
        <div className={`status-indicator ${getStatusClass()}`}></div>
        <span>{getStatusText()}</span>
        {serverStatus.status === 'running' && serverStatus.config && (
          <span className="ml-2">
            {serverStatus.config.host}:{serverStatus.config.port}
          </span>
        )}
      </div>
    </header>
  );
};
