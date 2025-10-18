# Architecture Overview

This document provides a high-level overview of the MCP Language Server architecture.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Client (LLM)                        │
│                    (e.g., Claude Desktop)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │ stdio (JSON-RPC)
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      MCP Server (index.ts)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Tool Request Handler                       │   │
│  │  - definition, references, hover, diagnostics, etc.     │   │
│  └─────────────────────────┬───────────────────────────────┘   │
└────────────────────────────┼───────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│   LSP Client            │   │  Workspace Watcher      │
│   (lsp/client.ts)       │◄──┤  (watcher/watcher.ts)   │
│                         │   │                         │
│  - Process management   │   │  - File monitoring      │
│  - Request/response     │   │  - Pattern matching     │
│  - Diagnostics cache    │   │  - Change notifications │
│  - File state tracking  │   │  - Gitignore filtering  │
└───────────┬─────────────┘   └─────────────────────────┘
            │ stdio (JSON-RPC)            │
            │                    ┌────────▼────────┐
            ▼                    │  File System    │
┌─────────────────────────┐     └─────────────────┘
│  LSP Server Process     │
│  (e.g., ts-language-    │
│   server, gopls, etc.)  │
│                         │
│  - Code analysis        │
│  - Type checking        │
│  - Semantic operations  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│     Source Code         │
│     (Workspace)         │
└─────────────────────────┘
```

## Component Interaction

### 1. Tool Call Flow

```
LLM Request
    ↓
MCP Server receives CallTool request
    ↓
Tool handler (e.g., readDefinition)
    ↓
Opens file via LSP Client
    ↓
Calls LSP method (e.g., workspace/symbol)
    ↓
LSP Client sends JSON-RPC request
    ↓
LSP Server analyzes code
    ↓
Response travels back up the chain
    ↓
Tool formats result
    ↓
MCP Server returns to LLM
```

### 2. File Change Flow

```
File System Change
    ↓
Chokidar detects event
    ↓
Workspace Watcher filters event
    ↓
Check against patterns & gitignore
    ↓
Debounce (100ms)
    ↓
Determine change type (create/change/delete)
    ↓
If file open → didChange notification
    ↓
Else → didChangeWatchedFiles notification
    ↓
LSP Server updates analysis
    ↓
Publishes new diagnostics
    ↓
LSP Client caches diagnostics
    ↓
Available for diagnostics tool
```

### 3. Server-Initiated Request Flow

```
LSP Server needs workspace edit
    ↓
Sends workspace/applyEdit request
    ↓
LSP Client receives via message handler
    ↓
Looks up registered handler
    ↓
Handler executes
    ↓
Returns response to LSP Server
```

## Key Design Decisions

### 1. **Bidirectional JSON-RPC**

The LSP protocol is bidirectional:
- Client sends requests to server (workspace/symbol, textDocument/hover)
- Server sends requests to client (workspace/applyEdit, client/registerCapability)
- Both send notifications (textDocument/didOpen, textDocument/publishDiagnostics)

Our implementation handles all three patterns with separate handler maps.

### 2. **File State Management**

Files must be explicitly opened before LSP operations:
```typescript
await client.openFile(filePath);  // Send didOpen
// ... perform operations ...
await client.closeFile(filePath); // Send didClose
```

This allows the LSP server to maintain accurate state.

### 3. **Workspace Watching**

The watcher serves two purposes:
1. **Automatic file opening**: Opens files matching LSP server patterns
2. **Change notification**: Notifies LSP server of file system changes

This ensures the LSP server stays synchronized with the file system.

### 4. **Debouncing**

File change events are debounced (100ms) to:
- Reduce load on LSP server
- Batch related changes (e.g., multiple files saved)
- Prevent notification spam

### 5. **Error Handling Strategy**

- **Transport errors**: Logged and propagated
- **LSP errors**: Converted to error responses
- **Tool errors**: Logged and returned as text
- **Cleanup errors**: Logged but don't prevent shutdown

### 6. **Logging Architecture**

Component-based logging allows fine-grained control:
```typescript
LOG_COMPONENT_LEVELS=lsp:DEBUG,watcher:INFO,tools:WARN
```

Components:
- **Core**: Main server lifecycle
- **LSP**: High-level LSP operations
- **Wire**: Raw JSON-RPC messages
- **LSP Process**: stderr from LSP server
- **Watcher**: File system events
- **Tools**: MCP tool execution

## Performance Considerations

### 1. **File Opening Strategy**

Files are opened on-demand by tools, but the watcher also opens files matching registered patterns. This:
- ✅ Ensures LSP server has context
- ✅ Enables accurate diagnostics
- ⚠️ Can be slow for large workspaces

Optimization: Files are opened in batches with delays.

### 2. **Diagnostic Caching**

Diagnostics are cached in the LSP client to avoid repeated requests:
```typescript
const diagnostics = client.getFileDiagnostics(uri);
```

### 3. **Message Parsing**

The `MessageReader` uses a buffer to handle partial messages efficiently:
- Accumulates chunks until headers are complete
- Waits for full content based on Content-Length
- Minimizes re-parsing

### 4. **Process Management**

The LSP server process is spawned once and reused:
- Initialization cost amortized
- State maintained across requests
- Graceful shutdown with timeout

## Extension Points

### Adding a New Tool

1. Create tool implementation in `src/tools/`:
   ```typescript
   export async function myNewTool(
     client: LSPClient,
     arg1: string,
     arg2: number
   ): Promise<string> {
     // Implementation
   }
   ```

2. Register in `src/index.ts`:
   ```typescript
   // In ListToolsRequestSchema handler
   {
     name: 'my_new_tool',
     description: '...',
     inputSchema: { /* ... */ }
   }

   // In CallToolRequestSchema handler
   case 'my_new_tool': {
     const result = await myNewTool(this.lspClient, args.arg1, args.arg2);
     return { content: [{ type: 'text', text: result }] };
   }
   ```

### Adding LSP Methods

Add to `src/lsp/methods.ts`:
```typescript
export async function myLspMethod(
  client: LSPClient,
  params: MyParams
): Promise<MyResult> {
  return client.call<MyResult>('textDocument/myMethod', params);
}
```

### Customizing File Watching

Modify `WatcherConfig` in `src/watcher/watcher.ts`:
```typescript
const customConfig = {
  ...defaultWatcherConfig(),
  maxFileSize: 50 * 1024 * 1024, // 50MB
  excludedDirs: new Set(['node_modules', 'custom_dir']),
};
```

## Testing Strategy

### Unit Tests
- Focus on pure functions and isolated components
- Mock external dependencies (file system, LSP server)
- Fast execution (<1s total)

### Integration Tests
- Test with real LSP servers
- Use temporary workspaces
- Skipped by default (opt-in with `RUN_INTEGRATION_TESTS=true`)
- Longer timeouts (10-30s)

### Manual Testing
- Use `LOG_LEVEL=DEBUG` to observe behavior
- Test with different language servers
- Verify file watching with live changes

## Common Issues and Solutions

### Issue: "Method not found" errors

**Cause**: LSP server doesn't support the requested method

**Solution**: Check server capabilities after initialization:
```typescript
const result = await client.initialize(workspace);
console.log(result.capabilities);
```

### Issue: Outdated diagnostics

**Cause**: File changes not detected or LSP server not notified

**Solution**: 
1. Check watcher logs: `LOG_COMPONENT_LEVELS=watcher:DEBUG`
2. Verify file isn't in gitignore
3. Ensure file is opened in LSP

### Issue: High memory usage

**Cause**: Too many files opened simultaneously

**Solution**:
1. Reduce workspace size (use more specific workspace path)
2. Add exclusions to `.gitignore`
3. Increase `maxFileSize` threshold

### Issue: Slow startup

**Cause**: Large workspace with many files

**Solution**:
1. The watcher opens files in batches with delays
2. Consider workspace-specific configuration
3. Some LSP servers support incremental initialization

## Security Considerations

### File Access
- The server has read/write access to the workspace
- File operations use LSP client's open file management
- No network access required

### Process Isolation
- LSP server runs in separate process
- Communication via stdio only
- No shell command injection (args properly escaped)

### Resource Limits
- File size limits prevent DoS
- Debouncing prevents event spam
- Process timeout for cleanup

## Future Enhancements

Potential areas for improvement:

1. **Incremental File Opening**: Open files on-demand rather than all at once
2. **Caching Layer**: Cache symbol lookups and definitions
3. **Multiple LSP Servers**: Support multiple languages in one workspace
4. **Progress Reporting**: Report long-running operations to client
5. **Configuration Files**: Support `.mcplsp.json` for workspace config
6. **Enhanced Pattern Matching**: More sophisticated glob support
7. **Performance Metrics**: Track and report operation timings

## Comparison: TypeScript vs Go

| Aspect | TypeScript | Go |
|--------|-----------|-----|
| Concurrency | Async/await, Promises | Goroutines, channels |
| Type System | Structural | Nominal |
| Error Handling | Exceptions | Explicit errors |
| Dependencies | NPM ecosystem | Go modules |
| Build | TypeScript compiler | Go compiler |
| Performance | Good (V8 JIT) | Excellent (native) |
| Memory | Higher baseline | Lower baseline |

Both implementations are functionally equivalent but leverage their respective language strengths.

