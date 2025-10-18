#!/bin/bash
# Install MCP Language Server globally

set -e

echo "📦 Installing MCP Language Server globally..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "   Please run this script from the typescript/ directory"
    exit 1
fi

# Build the project
echo "🔨 Building project..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed - dist/ directory not found"
    exit 1
fi

# Make the main file executable
chmod +x dist/index.js

# Add shebang to index.js if not present
if ! grep -q "^#!/usr/bin/env node" dist/index.js; then
    echo "Adding shebang to dist/index.js..."
    echo '#!/usr/bin/env node' | cat - dist/index.js > dist/index.js.tmp
    mv dist/index.js.tmp dist/index.js
    chmod +x dist/index.js
fi

# Install globally
echo "📦 Installing globally..."
npm install -g .

echo ""
echo "✅ Installation complete!"
echo ""
echo "📖 Usage:"
echo "   mcp-language-server --workspace /path/to/project --lsp typescript-language-server -- --stdio"
echo ""
echo "📝 Next steps:"
echo "   1. Install language servers (typescript-language-server, pyright, gopls, etc.)"
echo "   2. Configure in Claude Desktop - see DEPLOYMENT.md"
echo ""
echo "🔍 Verify installation:"
echo "   which mcp-language-server"
echo "   mcp-language-server --help"
echo ""

