# Deploying MCP Language Server

This guide explains how to deploy and use the MCP Language Server with MCP clients like Claude Desktop.

## Overview

The MCP Language Server is already a complete MCP server! The `src/index.ts` file contains:
- MCP server setup using `@modelcontextprotocol/sdk`
- Tool registration (definition, references, hover, etc.)
- LSP client integration
- Stdio transport for communication

## Prerequisites

1. **Build the project**:
```bash
cd typescript
npm install
npm run build
```

2. **Install language servers** you want to use:
```bash
# TypeScript
npm install -g typescript typescript-language-server

# Python
npm install -g pyright

# Go
go install golang.org/x/tools/gopls@latest

# Rust
rustup component add rust-analyzer
```

## Configuration for MCP Clients

### Claude Desktop (macOS)

**Config file location**: `~/Library/Application Support/Claude/claude_desktop_config.json`

#### TypeScript Projects

```json
{
  "mcpServers": {
    "typescript-workspace": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-language-server/typescript/dist/index.js",
        "--workspace",
        "/path/to/your/typescript/project",
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

#### Python Projects

```json
{
  "mcpServers": {
    "python-workspace": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-language-server/typescript/dist/index.js",
        "--workspace",
        "/path/to/your/python/project",
        "--lsp",
        "pyright-langserver",
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

#### Go Projects

```json
{
  "mcpServers": {
    "go-workspace": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-language-server/typescript/dist/index.js",
        "--workspace",
        "/path/to/your/go/project",
        "--lsp",
        "gopls"
      ],
      "env": {
        "PATH": "/usr/local/bin:/usr/bin:/bin:/usr/local/go/bin:${HOME}/go/bin",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

#### Multiple Projects

You can configure multiple workspaces:

```json
{
  "mcpServers": {
    "frontend-ts": {
      "command": "node",
      "args": [
        "/path/to/mcp-language-server/typescript/dist/index.js",
        "--workspace",
        "/path/to/frontend",
        "--lsp",
        "typescript-language-server",
        "--",
        "--stdio"
      ]
    },
    "backend-python": {
      "command": "node",
      "args": [
        "/path/to/mcp-language-server/typescript/dist/index.js",
        "--workspace",
        "/path/to/backend",
        "--lsp",
        "pyright-langserver",
        "--",
        "--stdio"
      ]
    }
  }
}
```

### Claude Desktop (Windows)

**Config file location**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "my-project": {
      "command": "node",
      "args": [
        "C:\\path\\to\\mcp-language-server\\typescript\\dist\\index.js",
        "--workspace",
        "C:\\path\\to\\your\\project",
        "--lsp",
        "typescript-language-server",
        "--",
        "--stdio"
      ]
    }
  }
}
```

### Claude Desktop (Linux)

**Config file location**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "my-project": {
      "command": "node",
      "args": [
        "/home/user/mcp-language-server/typescript/dist/index.js",
        "--workspace",
        "/home/user/projects/myproject",
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

Once configured, the following MCP tools will be available:

### 1. `definition`
Get the source code definition of a symbol.

**Input**:
```json
{
  "symbolName": "UserService"
}
```

**Usage in Claude**: "Get the definition of UserService"

### 2. `references`
Find all references to a symbol.

**Input**:
```json
{
  "symbolName": "addUser"
}
```

**Usage in Claude**: "Find all references to the addUser method"

### 3. `hover`
Get hover information at a specific location.

**Input**:
```json
{
  "filePath": "/path/to/file.ts",
  "line": 10,
  "column": 5
}
```

**Usage in Claude**: "Show hover info at line 10, column 5 in file.ts"

### 4. `diagnostics`
Get diagnostics (errors/warnings) for a file.

**Input**:
```json
{
  "filePath": "/path/to/file.ts",
  "contextLines": 5,
  "showLineNumbers": true
}
```

**Usage in Claude**: "Show diagnostics for file.ts"

### 5. `rename_symbol`
Rename a symbol across the codebase.

**Input**:
```json
{
  "filePath": "/path/to/file.ts",
  "line": 10,
  "column": 5,
  "newName": "newSymbolName"
}
```

**Usage in Claude**: "Rename the symbol at line 10 column 5 to newSymbolName"

### 6. `edit_file`
Apply text edits to a file.

**Input**:
```json
{
  "filePath": "/path/to/file.ts",
  "edits": [
    {
      "startLine": 10,
      "endLine": 12,
      "newText": "new code here"
    }
  ]
}
```

**Usage in Claude**: "Replace lines 10-12 with new code"

## Environment Variables

Configure behavior with environment variables:

```json
{
  "mcpServers": {
    "my-project": {
      "command": "node",
      "args": ["..."],
      "env": {
        "LOG_LEVEL": "DEBUG",
        "LOG_COMPONENT_LEVELS": "lsp:DEBUG,tools:INFO",
        "LOG_FILE": "/tmp/mcp-lsp.log",
        "LSP_CONTEXT_LINES": "10"
      }
    }
  }
}
```

### Available Environment Variables

- `LOG_LEVEL`: Global log level (DEBUG, INFO, WARN, ERROR, FATAL)
- `LOG_COMPONENT_LEVELS`: Per-component levels (e.g., "lsp:DEBUG,tools:INFO")
- `LOG_FILE`: Write logs to file in addition to stderr
- `LSP_CONTEXT_LINES`: Lines of context for references (default: 5)

## Testing Your Configuration

### 1. Check the config file

```bash
# macOS
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Linux
cat ~/.config/Claude/claude_desktop_config.json

# Windows
type %APPDATA%\Claude\claude_desktop_config.json
```

### 2. Test manually

```bash
cd /path/to/mcp-language-server/typescript

# Run the server manually
node dist/index.js \
  --workspace /path/to/your/project \
  --lsp typescript-language-server \
  -- --stdio
```

The server should start and wait for MCP messages on stdin.

### 3. Check logs

If you set `LOG_LEVEL=DEBUG` or `LOG_FILE`, check the logs:

```bash
# If using LOG_FILE
tail -f /tmp/mcp-lsp.log

# Claude Desktop logs (macOS)
tail -f ~/Library/Logs/Claude/mcp*.log
```

## Troubleshooting

### Server not appearing in Claude

1. **Restart Claude Desktop** after config changes
2. **Check config syntax**: Ensure valid JSON
3. **Verify paths**: Use absolute paths
4. **Check permissions**: Ensure files are readable

### Language server not found

1. **Check installation**:
```bash
which typescript-language-server
which pyright-langserver
which gopls
```

2. **Update PATH** in config:
```json
{
  "env": {
    "PATH": "/usr/local/bin:/usr/bin:/bin:/custom/path"
  }
}
```

### No symbols found

1. **Wait for analysis**: LSP servers need time to analyze code
2. **Check file opening**: Enable DEBUG logs
3. **Verify project config**: Ensure tsconfig.json, go.mod, etc. exist

### Performance issues

1. **Reduce context lines**:
```json
{
  "env": {
    "LSP_CONTEXT_LINES": "3"
  }
}
```

2. **Add to .gitignore**:
```
node_modules/
dist/
build/
.git/
```

3. **Use specific workspace**: Don't use root directory

## Advanced Configuration

### Custom Language Server Arguments

Pass arguments to the language server after `--`:

```json
{
  "args": [
    "dist/index.js",
    "--workspace", "/path/to/project",
    "--lsp", "pyright-langserver",
    "--",
    "--stdio",
    "--verbose"
  ]
}
```

### Environment Variable Substitution

Some MCP clients support environment variables:

```json
{
  "args": [
    "${HOME}/mcp-language-server/typescript/dist/index.js",
    "--workspace", "${HOME}/projects/myproject"
  ]
}
```

### Per-Language Server Environment

```json
{
  "mcpServers": {
    "go-project": {
      "command": "node",
      "args": ["dist/index.js", "--workspace", "/project", "--lsp", "gopls"],
      "env": {
        "GOPATH": "/custom/gopath",
        "GOCACHE": "/custom/gocache",
        "GO111MODULE": "on"
      }
    }
  }
}
```

## Production Deployment

### Option 1: Direct Node Execution (Recommended)

```json
{
  "command": "node",
  "args": ["/path/to/dist/index.js", "--workspace", "...", "--lsp", "..."]
}
```

### Option 2: Create Executable Script

Create `mcp-lsp.sh`:
```bash
#!/bin/bash
cd /path/to/mcp-language-server/typescript
node dist/index.js "$@"
```

Make executable:
```bash
chmod +x mcp-lsp.sh
```

Configure:
```json
{
  "command": "/path/to/mcp-lsp.sh",
  "args": ["--workspace", "/path/to/project", "--lsp", "gopls"]
}
```

### Option 3: NPM Global Installation

Add to `package.json`:
```json
{
  "name": "mcp-language-server",
  "bin": {
    "mcp-language-server": "./dist/index.js"
  }
}
```

Install globally:
```bash
npm install -g .
```

Configure:
```json
{
  "command": "mcp-language-server",
  "args": ["--workspace", "/path/to/project", "--lsp", "gopls"]
}
```

## Example: Complete Setup for TypeScript Project

1. **Build the MCP server**:
```bash
cd /path/to/mcp-language-server/typescript
npm install
npm run build
```

2. **Install TypeScript language server**:
```bash
npm install -g typescript typescript-language-server
```

3. **Configure Claude Desktop**:
```json
{
  "mcpServers": {
    "my-ts-project": {
      "command": "node",
      "args": [
        "/Users/me/mcp-language-server/typescript/dist/index.js",
        "--workspace",
        "/Users/me/projects/my-app",
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

4. **Restart Claude Desktop**

5. **Test in Claude**:
- "Get the definition of UserService"
- "Find all references to fetchData"
- "Show diagnostics for src/app.ts"

## Next Steps

- See [QUICKSTART.md](QUICKSTART.md) for usage examples
- See [README.md](README.md) for architecture details
- See [MULTI_LANGUAGE_TEST_RESULTS.md](MULTI_LANGUAGE_TEST_RESULTS.md) for language-specific features

## Support

If you encounter issues:
1. Check logs with `LOG_LEVEL=DEBUG`
2. Test manually first
3. Verify language server installation
4. Check file permissions and paths

