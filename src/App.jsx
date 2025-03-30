import React, { useState, useEffect } from 'react';
import { Dashboard } from './views/Dashboard';
import { Settings } from './views/Settings';
import { ConnectionsEnhanced as Connections } from './views/ConnectionsEnhanced';
import { Plugins } from './views/Plugins';
import { Logs } from './views/Logs';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

const App = () => {
  const [view, setView] = useState('dashboard');
  const [serverStatus, setServerStatus] = useState({
    status: 'unknown',
    config: {}
  });
  
  useEffect(() => {
    // Request server status on load
    if (window.electron) {
      window.electron.getServerStatus()
        .then(status => {
          setServerStatus(status);
        })
        .catch(err => {
          console.error('Failed to get server status', err);
        });
      
      // Set up server status listener
      const unsubscribe = window.electron.onServerStatus((status) => {
        setServerStatus(status);
      });
      
      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, []);
  
  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard serverStatus={serverStatus} />;
      case 'settings':
        return <Settings serverStatus={serverStatus} />;
      case 'connections':
        return <Connections />;
      case 'plugins':
        return <Plugins />;
      case 'logs':
        return <Logs />;
      default:
        return <Dashboard serverStatus={serverStatus} />;
    }
  };
  
  return (
    <div className="app">
      <Header serverStatus={serverStatus} />
      <div className="app-content">
        <Sidebar currentView={view} onChangeView={setView} />
        <main className="content">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default App;
