import React, { useState, useEffect } from 'react';
import { ServerControls } from '../components/ServerControls';

export const Dashboard = ({ serverStatus }) => {
  const [stats, setStats] = useState({
    connections: 0,
    messagesProcessed: 0,
    uptime: 0
  });

  useEffect(() => {
    // In a real app, we would fetch stats from the server
    // or set up a listener for stats updates
    const interval = setInterval(() => {
      if (serverStatus.status === 'running') {
        setStats(prev => ({
          ...prev,
          uptime: prev.uptime + 1
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [serverStatus.status]);

  const formatUptime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  return (
    <div className="dashboard">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Server Status</h2>
        </div>
        <div className="card-content">
          <ServerControls serverStatus={serverStatus} />
          
          {serverStatus.status === 'running' && (
            <div className="mt-3">
              <div className="d-flex justify-between mb-2">
                <span>Host:</span>
                <span>{serverStatus.config.host || 'localhost'}</span>
              </div>
              <div className="d-flex justify-between mb-2">
                <span>Port:</span>
                <span>{serverStatus.config.port || 3030}</span>
              </div>
              <div className="d-flex justify-between">
                <span>Uptime:</span>
                <span>{formatUptime(stats.uptime)}</span>
              </div>
            </div>
          )}

          {serverStatus.status === 'error' && (
            <div className="mt-3 text-danger">
              {serverStatus.error || 'An error occurred with the server'}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Connections</h2>
        </div>
        <div className="card-content">
          <div className="d-flex justify-between mb-2">
            <span>Active Connections:</span>
            <span>{stats.connections}</span>
          </div>
          <div className="d-flex justify-between">
            <span>Messages Processed:</span>
            <span>{stats.messagesProcessed}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Quick Actions</h2>
        </div>
        <div className="card-content">
          <button
            className="btn btn-primary mb-2"
            style={{ width: '100%' }}
            onClick={() => window.open('https://github.com/neel-jay/claudeUIMCP', '_blank')}
          >
            View Documentation
          </button>
          
          <button
            className="btn btn-secondary"
            style={{ width: '100%' }}
            onClick={() => {/* Open logs */}}
          >
            View Logs
          </button>
        </div>
      </div>
    </div>
  );
};
