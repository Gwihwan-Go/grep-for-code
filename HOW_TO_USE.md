# How to Use MCP Language Server

## Quick Start (3 Steps)

### 1. Build the Server

```bash
cd /mcp-language-server/typescript
npm install
npm run build
```

### 2. Install Language Servers

Choose the language server(s) you need:

```bash
# TypeScript/JavaScript
npm install -g typescript typescript-language-server

# Python
npm install -g pyright

# Go (requires Go installed)
go install golang.org/x/tools/gopls@latest
```

### 3. Configure Claude Desktop

Edit your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add:

```json
{
  "mcpServers": {
    "my-project": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/mcp-language-server/typescript/dist/index.js",
        "--workspace",
        "/path/to/your/project",
        "--lsp",
        "typescript-language-server",
        "--",
        "--stdio"
      ]
    }
  }
}
```

**Important**: 
- Use ABSOLUTE paths, not relative paths
- Replace `/ABSOLUTE/PATH/TO/` with your actual path
- Replace `/path/to/your/project` with your actual project path

### 4. Restart Claude Desktop

After editing the config, restart Claude Desktop completely.

## Verify It's Working

In Claude, try these commands:

1. "What tools do you have available?"
   - You should see: definition, references, hover, diagnostics, edit_file, rename_symbol

2. "Get the definition of [YourClassName]"
   - Should show the source code

3. "Find all references to [YourFunction]"
   - Should show where it's used

## Example Configurations

### TypeScript Project

```json
{
  "mcpServers": {
    "frontend": {
      "command": "node",
      "args": [
        "/Users/me/mcp-language-server/typescript/dist/index.js",
        "--workspace",
        "/Users/me/projects/my-frontend",
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

### Python Project

```json
{
  "mcpServers": {
    "backend": {
      "command": "node",
      "args": [
        "/Users/me/mcp-language-server/typescript/dist/index.js",
        "--workspace",
        "/Users/me/projects/my-backend",
        "--lsp",
        "pyright-langserver",
        "--",
        "--stdio"
      ]
    }
  }
}
```

### Go Project

```json
{
  "mcpServers": {
    "api": {
      "command": "node",
      "args": [
        "/Users/me/mcp-language-server/typescript/dist/index.js",
        "--workspace",
        "/Users/me/projects/my-api",
        "--lsp",
        "gopls"
      ],
      "env": {
        "PATH": "/usr/local/bin:/usr/bin:/bin:/usr/local/go/bin:/Users/me/go/bin"
      }
    }
  }
}
```

## Available Tools

### `definition` - Get Symbol Definition

**What it does**: Shows the complete source code where a symbol is defined.

**Example prompts**:
- "Get the definition of UserService"
- "Show me the User class definition"
- "What does the calculateTotal function do?"

### `references` - Find All References

**What it does**: Finds everywhere a symbol is used in your codebase.

**Example prompts**:
- "Find all references to addUser"
- "Where is the User class used?"
- "Show me all calls to fetchData"

### `hover` - Get Type Information

**What it does**: Shows type information and documentation at a specific location.

**Example prompts**:
- "Show hover info at line 50, column 10 in src/app.ts"
- "What's the type at line 25 in main.py?"

### `diagnostics` - Get Errors and Warnings

**What it does**: Shows compilation errors, type errors, and warnings.

**Example prompts**:
- "Show diagnostics for src/app.ts"
- "What errors are in main.py?"
- "Check the file src/utils.go for issues"

### `rename_symbol` - Rename Across Codebase

**What it does**: Renames a symbol everywhere it's used.

**Example prompts**:
- "Rename the symbol at line 10, column 5 in app.ts to newName"
- "Refactor: rename oldFunction to newFunction at src/app.ts:25:10"

### `edit_file` - Apply Text Edits

**What it does**: Replaces specific lines in a file.

**Example prompts**:
- "Replace lines 10-15 in app.ts with: [new code]"
- "Edit src/main.py lines 20-22 to add error handling"

## Troubleshooting

### "I don't see the tools"

1. Check config file syntax (must be valid JSON)
2. Restart Claude Desktop completely
3. Check Claude logs: `~/Library/Logs/Claude/`

### "Language server not found"

1. Verify installation:
```bash
which typescript-language-server
which pyright-langserver  
which gopls
```

2. Add to PATH in config:
```json
{
  "env": {
    "PATH": "/usr/local/bin:/usr/bin:/bin:/custom/path"
  }
}
```

### "No symbols found"

1. Wait 3-5 seconds for analysis to complete
2. Check your project has config files:
   - TypeScript: `tsconfig.json`
   - Python: `pyproject.toml` or setup files
   - Go: `go.mod`

### "Permission denied"

Make sure the dist/index.js is readable:
```bash
chmod +x /path/to/mcp-language-server/typescript/dist/index.js
```

## Advanced Usage

### Enable Debug Logging

```json
{
  "env": {
    "LOG_LEVEL": "DEBUG",
    "LOG_FILE": "/tmp/mcp-lsp.log"
  }
}
```

Then check the log:
```bash
tail -f /tmp/mcp-lsp.log
```

### Multiple Projects

You can add multiple workspaces:

```json
{
  "mcpServers": {
    "project-a": {
      "command": "node",
      "args": ["...", "--workspace", "/path/to/a", "--lsp", "typescript-language-server", "--", "--stdio"]
    },
    "project-b": {
      "command": "node",
      "args": ["...", "--workspace", "/path/to/b", "--lsp", "pyright-langserver", "--", "--stdio"]
    }
  }
}
```

### Custom Context Lines

Control how many context lines are shown:

```json
{
  "env": {
    "LSP_CONTEXT_LINES": "10"
  }
}
```

## Testing Manually

Before configuring Claude, test manually:

```bash
cd /mcp-language-server/typescript

# Test TypeScript
node dist/index.js \
  --workspace /path/to/your/project \
  --lsp typescript-language-server \
  -- --stdio

# Test Python  
node dist/index.js \
  --workspace /path/to/your/project \
  --lsp pyright-langserver \
  -- --stdio

# Test Go
node dist/index.js \
  --workspace /path/to/your/project \
  --lsp gopls
```

The server should start and wait for input (stdin). Press Ctrl+C to stop.

## Global Installation (Optional)

To make it easier to use:

```bash
cd /mcp-language-server/typescript
./install-global.sh
```

Then use:
```json
{
  "command": "mcp-language-server",
  "args": ["--workspace", "...", "--lsp", "..."]
}
```

## What to Expect

When working with Claude:

1. **First time**: Claude will analyze your codebase (3-10 seconds)
2. **Symbol queries**: Fast (< 1 second)
3. **References**: Moderate (1-3 seconds for large codebases)
4. **Diagnostics**: Instant (cached from language server)

## Example Session

```
You: "Get the definition of UserService class"

Claude: [Uses definition tool]
```

Output:
```typescript
Symbol: UserService
File: src/services/user.service.ts
Kind: Class

export class UserService {
  private users: User[] = [];
  
  addUser(user: User): void {
    this.users.push(user);
  }
  // ... more code
}
```

```
You: "Find all references to addUser"

Claude: [Uses references tool]
```

Output:
```
src/controllers/user.controller.ts
References: 2
At: L15:C10, L23:C10

15|   service.addUser(newUser);
23|   this.service.addUser(user);
```

## Next Steps

- See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment options
- See [QUICKSTART.md](QUICKSTART.md) for more usage examples  
- See [MULTI_LANGUAGE_TEST_RESULTS.md](MULTI_LANGUAGE_TEST_RESULTS.md) for language-specific features

## Support

For issues:
1. Check logs with `LOG_LEVEL=DEBUG`
2. Verify language server is installed and in PATH
3. Test manually first before configuring Claude
4. Check file permissions and absolute paths

