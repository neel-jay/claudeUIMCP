import React from 'react';

export const ServerControls = ({ serverStatus }) => {
  const startServer = () => {
    if (window.electron) {
      window.electron.startServer();
    }
  };

  const stopServer = () => {
    if (window.electron) {
      window.electron.stopServer();
    }
  };

  return (
    <div className="server-controls">
      {serverStatus.status === 'running' ? (
        <button 
          className="btn btn-danger" 
          onClick={stopServer}
        >
          Stop Server
        </button>
      ) : (
        <button 
          className="btn btn-success" 
          onClick={startServer}
          disabled={serverStatus.status === 'unknown'}
        >
          Start Server
        </button>
      )}
    </div>
  );
};
