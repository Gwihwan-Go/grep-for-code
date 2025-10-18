# MCP Language Server - Export & Deployment Guide

## 🎯 Overview

The MCP Language Server you've built is **already a complete MCP server**. It just needs to be configured in an MCP client (like Claude Desktop) to start using it.

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Desktop (MCP Client)              │
│                                                             │
│  User asks: "Get the definition of UserService"            │
└────────────────────────┬────────────────────────────────────┘
                         │ MCP Protocol (stdio)
                         │
┌────────────────────────▼────────────────────────────────────┐
│              MCP Language Server (Your Code)                │
│              typescript/dist/index.js                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  MCP Tools:                                         │   │
│  │  - definition                                       │   │
│  │  - references                                       │   │
│  │  - hover                                            │   │
│  │  - diagnostics                                      │   │
│  │  - rename_symbol                                    │   │
│  │  - edit_file                                        │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ LSP Protocol (stdio)
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Language Server Process                        │
│  (typescript-language-server / pyright / gopls / etc.)     │
│                                                             │
│  Analyzes code, provides semantic information               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    Your Source Code                         │
│              (TypeScript / Python / Go / etc.)              │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Three Ways to Deploy

### Method 1: Direct Node Execution (Simplest)

**Config** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "my-project": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-language-server/typescript/dist/index.js",
        "--workspace", "/path/to/your/project",
        "--lsp", "typescript-language-server",
        "--", "--stdio"
      ]
    }
  }
}
```

**Pros**: Simple, direct  
**Cons**: Need to specify full path

---

### Method 2: Shell Script Wrapper

**1. Create wrapper** (`mcp-lsp-wrapper.sh`):
```bash
#!/bin/bash
cd /path/to/mcp-language-server/typescript
exec node dist/index.js "$@"
```

**2. Make executable**:
```bash
chmod +x mcp-lsp-wrapper.sh
```

**3. Config**:
```json
{
  "mcpServers": {
    "my-project": {
      "command": "/path/to/mcp-lsp-wrapper.sh",
      "args": ["--workspace", "/project", "--lsp", "gopls"]
    }
  }
}
```

**Pros**: Cleaner config, easier to update  
**Cons**: Extra script file

---

### Method 3: Global NPM Installation (Most Convenient)

**1. Install globally**:
```bash
cd /mcp-language-server/typescript
./install-global.sh
```

**2. Config**:
```json
{
  "mcpServers": {
    "my-project": {
      "command": "mcp-language-server",
      "args": ["--workspace", "/project", "--lsp", "gopls"]
    }
  }
}
```

**3. Verify**:
```bash
which mcp-language-server
mcp-language-server --help
```

**Pros**: Cleanest, available everywhere  
**Cons**: Requires npm global install

---

## 📝 Complete Setup Example

### Step-by-Step: TypeScript Project

#### 1. Build MCP Server
```bash
cd /mcp-language-server/typescript
npm install
npm run build
```

#### 2. Install Language Server
```bash
npm install -g typescript typescript-language-server
```

#### 3. Create Config File

**Location**:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Content**:
```json
{
  "mcpServers": {
    "my-typescript-project": {
      "command": "node",
      "args": [
        "/Users/yourname/mcp-language-server/typescript/dist/index.js",
        "--workspace",
        "/Users/yourname/projects/my-app",
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

#### 4. Restart Claude Desktop

Completely quit and restart Claude Desktop.

#### 5. Test

In Claude, type:
```
What tools do you have available?
```

You should see: `definition`, `references`, `hover`, `diagnostics`, `rename_symbol`, `edit_file`

Then try:
```
Get the definition of [YourClassName]
```

---

## 🌍 Multi-Language Setup

You can configure multiple projects with different language servers:

```json
{
  "mcpServers": {
    "frontend-typescript": {
      "command": "node",
      "args": [
        "/path/to/mcp-language-server/typescript/dist/index.js",
        "--workspace", "/Users/me/projects/frontend",
        "--lsp", "typescript-language-server",
        "--", "--stdio"
      ]
    },
    "backend-python": {
      "command": "node",
      "args": [
        "/path/to/mcp-language-server/typescript/dist/index.js",
        "--workspace", "/Users/me/projects/backend",
        "--lsp", "pyright-langserver",
        "--", "--stdio"
      ]
    },
    "api-go": {
      "command": "node",
      "args": [
        "/path/to/mcp-language-server/typescript/dist/index.js",
        "--workspace", "/Users/me/projects/api",
        "--lsp", "gopls"
      ],
      "env": {
        "PATH": "/usr/local/bin:/usr/bin:/bin:/usr/local/go/bin:/Users/me/go/bin"
      }
    }
  }
}
```

---

## 🔧 Configuration Options

### Required Arguments

```bash
--workspace /path/to/project   # Your project directory
--lsp typescript-language-server  # Language server command
```

### Optional Arguments (after --)

Pass arguments to the language server:

```json
{
  "args": [
    "dist/index.js",
    "--workspace", "/project",
    "--lsp", "pyright-langserver",
    "--",
    "--stdio",           # LSP server arg
    "--verbose"          # LSP server arg
  ]
}
```

### Environment Variables

```json
{
  "env": {
    "LOG_LEVEL": "DEBUG",              # DEBUG, INFO, WARN, ERROR
    "LOG_FILE": "/tmp/mcp-lsp.log",    # Log to file
    "LSP_CONTEXT_LINES": "10",         # Context lines in references
    "PATH": "/custom/path"             # Custom PATH for language servers
  }
}
```

---

## 🎓 How It Works

### Request Flow

1. **User → Claude**: "Get the definition of UserService"

2. **Claude → MCP Server**: MCP `callTool` request
   ```json
   {
     "name": "definition",
     "arguments": { "symbolName": "UserService" }
   }
   ```

3. **MCP Server → LSP Server**: LSP `workspace/symbol` request
   ```json
   {
     "method": "workspace/symbol",
     "params": { "query": "UserService" }
   }
   ```

4. **LSP Server** analyzes code, returns locations

5. **MCP Server** formats results, sends back to Claude

6. **Claude** displays to user

### File Management

The MCP server automatically:
- Opens files when needed
- Tracks open file state
- Receives real-time diagnostics
- Closes files on shutdown

### Caching

- **Diagnostics**: Cached by LSP server, updated on file changes
- **Symbols**: Indexed by LSP server
- **Type info**: Computed on-demand

---

## 🐛 Troubleshooting

### Problem: Tools not showing up

**Solution**:
1. Check JSON syntax in config file
2. Restart Claude Desktop (completely quit)
3. Check absolute paths (no ~, no relative paths)

### Problem: "Language server not found"

**Solution**:
```bash
# Verify installation
which typescript-language-server
which pyright-langserver
which gopls

# Add to PATH in config
{
  "env": {
    "PATH": "/usr/local/bin:/usr/bin:/bin:/custom/path"
  }
}
```

### Problem: "No symbols found"

**Solution**:
1. Wait 5 seconds for analysis
2. Check project has config files (tsconfig.json, go.mod, etc.)
3. Enable debug logging:
```json
{
  "env": {
    "LOG_LEVEL": "DEBUG",
    "LOG_FILE": "/tmp/debug.log"
  }
}
```

### Problem: Slow performance

**Solution**:
```json
{
  "env": {
    "LSP_CONTEXT_LINES": "3"  # Reduce context
  }
}
```

Add to `.gitignore`:
```
node_modules/
dist/
build/
.git/
```

---

## 📦 Distribution Options

### Option 1: Git Clone

Users clone your repo:
```bash
git clone https://github.com/your/repo.git
cd repo/typescript
npm install
npm run build
```

### Option 2: NPM Package

Publish to npm:
```bash
npm publish
```

Users install:
```bash
npm install -g mcp-language-server-ts
```

### Option 3: Pre-built Binary (Future)

Use `pkg` or similar to create standalone executables:
```bash
npm install -g pkg
pkg dist/index.js --output mcp-lsp
```

---

## ✅ Verification Checklist

- [ ] Built the project (`npm run build`)
- [ ] Installed language server(s)
- [ ] Created config file with absolute paths
- [ ] Restarted Claude Desktop
- [ ] Tested with "What tools do you have available?"
- [ ] Tried a definition query

---

## 📚 Additional Resources

- **[HOW_TO_USE.md](HOW_TO_USE.md)** - Quick start guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Detailed deployment docs
- **[QUICKSTART.md](QUICKSTART.md)** - Usage examples
- **[example-claude-config.json](example-claude-config.json)** - Config templates

---

## 🎉 You're Ready!

Your MCP Language Server is now ready to be used by Claude Desktop or any other MCP client. The server provides deep semantic code understanding to LLMs through the Language Server Protocol!

**What LLMs can now do**:
- ✅ Understand code structure
- ✅ Navigate large codebases
- ✅ Find definitions and references
- ✅ Get type information
- ✅ See real-time errors
- ✅ Refactor code safely
- ✅ Work with multiple languages

Happy coding! 🚀

