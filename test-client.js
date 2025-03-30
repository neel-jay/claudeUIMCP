/**
 * Test client for MCP Server
 * This script connects to the MCP server and sends a few test messages
 */

const WebSocket = require('ws');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Server connection details
const serverUrl = 'ws://localhost:3030';
let ws = null;
let connected = false;

// Connect to the server
function connect() {
  console.log(`Connecting to ${serverUrl}...`);
  
  ws = new WebSocket(serverUrl);
  
  ws.on('open', () => {
    connected = true;
    console.log('Connected to server');
    showMenu();
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('\nReceived message:');
      console.log(JSON.stringify(message, null, 2));
      console.log('');
      showMenu();
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
  });
  
  ws.on('close', () => {
    connected = false;
    console.log('Disconnected from server');
    rl.question('Reconnect? (y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        connect();
      } else {
        rl.close();
      }
    });
  });
}

// Send a message to the server
function sendMessage(type, data = {}) {
  if (!connected) {
    console.log('Not connected to server');
    return;
  }
  
  const message = {
    type,
    data,
    timestamp: Date.now()
  };
  
  console.log('Sending message:');
  console.log(JSON.stringify(message, null, 2));
  
  ws.send(JSON.stringify(message));
}

// Show the menu
function showMenu() {
  console.log('Choose an action:');
  console.log('1. Send server.info request');
  console.log('2. Send server.echo request');
  console.log('3. Send example.echo request');
  console.log('4. Send plugins.list request');
  console.log('5. Send proxy.request (mock API)');
  console.log('0. Disconnect');
  
  rl.question('Action: ', (answer) => {
    switch (answer) {
      case '1':
        sendMessage('server.info');
        break;
        
      case '2':
        rl.question('Enter message to echo: ', (message) => {
          sendMessage('server.echo', { message });
        });
        break;
        
      case '3':
        rl.question('Enter message to echo: ', (message) => {
          sendMessage('example.echo', { message });
        });
        break;
        
      case '4':
        sendMessage('plugins.list');
        break;
        
      case '5':
        sendMessage('proxy.request', {
          route: 'mock-ai',
          endpoint: '/models',
          method: 'GET'
        });
        break;
        
      case '0':
        ws.close();
        break;
        
      default:
        console.log('Invalid option');
        showMenu();
        break;
    }
  });
}

// Start the client
connect();

// Handle process termination
process.on('SIGINT', () => {
  if (ws) {
    ws.close();
  }
  
  rl.close();
});
