import React from 'react';

export const Sidebar = ({ currentView, onChangeView }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'connections', label: 'Connections', icon: '🔌' },
    { id: 'plugins', label: 'Plugins', icon: '🔧' },
    { id: 'logs', label: 'Logs', icon: '📝' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="sidebar">
      <ul className="nav-items">
        {navItems.map((item) => (
          <li
            key={item.id}
            className={`nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onChangeView(item.id)}
          >
            <span className="nav-item-icon">{item.icon}</span>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
};
