#!/bin/bash

# Setup script for Claude UI MCP Server

echo "Setting up Claude UI MCP Server development environment..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Create build directory
mkdir -p build

# Copy necessary files
echo "Setting up build environment..."
cp index.html build/
cp -r assets build/

echo "Setup complete! You can now run the application:"
echo "npm run dev - Run in development mode"
echo "npm run build:mac - Build for macOS"
