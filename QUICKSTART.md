# Quick Start Guide

## Installation

1. **Install Node.js** (v18 or higher)
   ```bash
   node --version  # Should be 18.0.0 or higher
   ```

2. **Install dependencies**
   ```bash
   cd typescript
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

## Running the Server

### With TypeScript Language Server

1. **Install typescript-language-server**
   ```bash
   npm install -g typescript typescript-language-server
   ```

2. **Run the MCP server**
   ```bash
   node dist/index.js \
     --workspace /path/to/your/typescript/project \
     --lsp typescript-language-server \
     -- --stdio
   ```

### With Python Language Server (pyright)

1. **Install pyright**
   ```bash
   npm install -g pyright
   ```

2. **Run the MCP server**
   ```bash
   node dist/index.js \
     --workspace /path/to/your/python/project \
     --lsp pyright-langserver \
     -- --stdio
   ```

### With Go Language Server (gopls)

1. **Install gopls**
   ```bash
   go install golang.org/x/tools/gopls@latest
   ```

2. **Run the MCP server**
   ```bash
   node dist/index.js \
     --workspace /path/to/your/go/project \
     --lsp gopls
   ```

## Configuration

### Environment Variables

```bash
# Enable debug logging
export LOG_LEVEL=DEBUG

# Set component-specific log levels
export LOG_COMPONENT_LEVELS="lsp:DEBUG,tools:INFO"

# Write logs to file
export LOG_FILE=/tmp/mcp-language-server.log

# Set context lines for references
export LSP_CONTEXT_LINES=10
```

### Example: Debug Mode

```bash
LOG_LEVEL=DEBUG node dist/index.js \
  --workspace . \
  --lsp typescript-language-server \
  -- --stdio
```

## Using with MCP Clients

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "language-server": {
      "command": "node",
      "args": [
        "/path/to/mcp-language-server/typescript/dist/index.js",
        "--workspace",
        "/path/to/your/project",
        "--lsp",
        "typescript-language-server",
        "--",
        "--stdio"
      ],
      "env": {
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

## Available Tools

Once connected, the following MCP tools are available:

1. **definition** - Get symbol definition
   ```
   Input: { symbolName: "MyClass.myMethod" }
   ```

2. **references** - Find all references to a symbol
   ```
   Input: { symbolName: "myFunction" }
   ```

3. **diagnostics** - Get diagnostics for a file
   ```
   Input: { filePath: "/path/to/file.ts", contextLines: 5, showLineNumbers: true }
   ```

4. **hover** - Get hover information
   ```
   Input: { filePath: "/path/to/file.ts", line: 10, column: 5 }
   ```

5. **rename_symbol** - Rename a symbol
   ```
   Input: { filePath: "/path/to/file.ts", line: 10, column: 5, newName: "newName" }
   ```

6. **edit_file** - Apply text edits
   ```
   Input: { 
     filePath: "/path/to/file.ts",
     edits: [
       { startLine: 10, endLine: 12, newText: "new code" }
     ]
   }
   ```

## Development

### Run tests
```bash
npm test
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Watch mode
```bash
npm run watch
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## Troubleshooting

### Language server not found

Make sure the language server is installed and in your PATH:
```bash
which typescript-language-server
which gopls
which pyright-langserver
```

### No symbols found

Ensure your project has the necessary configuration files:
- TypeScript: `tsconfig.json`
- Go: `go.mod`
- Python: `pyproject.toml` or similar

### Diagnostics not appearing

Wait a moment after opening files - diagnostics are published asynchronously.
You can check logs with `LOG_LEVEL=DEBUG`.

### Files not being watched

Check the watcher logs with `LOG_COMPONENT_LEVELS=watcher:DEBUG`.
Ensure files aren't excluded by gitignore patterns.

## Performance Tips

1. **Exclude large directories** - Add to `.gitignore`:
   ```
   node_modules
   dist
   build
   .git
   ```

2. **Limit file size** - The watcher automatically skips files > 10MB

3. **Debounce time** - File changes are debounced by 100ms to reduce load

## Next Steps

- Read the [full README](./README.md) for architecture details
- Check the [tests](./src/__tests__/) for usage examples
- Explore the [source code](./src/) to understand the implementation

