# Claude UI MCP Server

An Electron-based desktop application that provides a GUI for the Claude UI Message Control Protocol (MCP) server. This application makes it easy to manage connections and configure the server without needing to use the command line.

## Features

- Graphical user interface for the MCP server
- Server controls (start, stop, restart)
- Connection management
- Configuration settings
- Dashboard with server statistics
- System tray integration

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Getting Started

1. Clone the repository:
   ```
   git clone https://github.com/neel-jay/claudeUIMCP.git
   cd claudeUIMCP
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the setup script:
   ```
   ./setup.sh
   ```

4. Start the development server:
   ```
   npm run dev
   ```

### Building for Production

To build the application for macOS:

```
npm run build:mac
```

The built application will be located in the `dist` directory.

## Project Structure

- `electron/` - Electron main process code
  - `main.js` - Main Electron process
  - `preload.js` - Preload script for context isolation
  - `server/` - MCP server implementation
- `src/` - React frontend code
  - `components/` - Reusable React components
  - `views/` - Page components
  - `utils/` - Utility functions
  - `store/` - Application state management
- `assets/` - Application icons and resources

## License

MIT
