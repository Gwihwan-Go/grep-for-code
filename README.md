# MCP Language Server (TypeScript)

A Model Context Protocol (MCP) server that wraps Language Server Protocol (LSP) servers, making language server capabilities available to LLMs through MCP.

## Overview

This project bridges two important protocols:

- **LSP (Language Server Protocol)**: Provides semantic understanding of code (definitions, references, diagnostics, etc.)
- **MCP (Model Context Protocol)**: Makes these capabilities accessible to LLMs

By wrapping LSP servers with MCP, LLMs can gain deep semantic understanding of codebases, enabling them to navigate, analyze, and refactor code more effectively.

## Architecture

### High-Level Structure

```
src/
├── index.ts              # Main entry point and MCP server setup
├── logging/              # Logging infrastructure
│   └── logger.ts         # Component-based logging system
├── protocol/             # LSP protocol types
│   ├── types.ts          # Type definitions and wrappers
│   └── uri.ts            # URI utilities
├── lsp/                  # LSP client implementation
│   ├── client.ts         # LSP client and process management
│   ├── transport.ts      # JSON-RPC message transport
│   └── methods.ts        # LSP method wrappers
├── watcher/              # File system watching
│   ├── watcher.ts        # Workspace file watcher
│   └── gitignore.ts      # Gitignore pattern matching
└── tools/                # MCP tool implementations
    ├── utilities.ts      # Shared utility functions
    ├── definition.ts     # Get symbol definitions
    ├── references.ts     # Find symbol references
    ├── hover.ts          # Get hover information
    ├── diagnostics.ts    # Get diagnostics (errors/warnings)
    ├── edit.ts           # Apply text edits
    └── rename.ts         # Rename symbols
```

### Component Details

#### 1. Logging System (`logging/`)

**Purpose**: Provides structured, component-based logging with configurable levels.

**Key Features**:
- Component-based filtering (Core, LSP, Wire, LSP Process, Watcher, Tools)
- Configurable log levels (DEBUG, INFO, WARN, ERROR, FATAL)
- Environment variable configuration (`LOG_LEVEL`, `LOG_COMPONENT_LEVELS`, `LOG_FILE`)

**Example**:
```typescript
const logger = createLogger(Component.LSP);
logger.debug('Processing request: %s', requestId);
logger.error('Failed to initialize: %s', err);
```

#### 2. Protocol Layer (`protocol/`)

**Purpose**: Type definitions and utilities for LSP protocol.

**Components**:
- `types.ts`: Re-exports VSCode LSP types and provides wrapper interfaces
- `uri.ts`: URI conversion utilities (`pathToUri`, `uriToPath`)

**Key Abstractions**:
- `ISymbol`: Unified interface for `SymbolInformation` and `WorkspaceSymbol`
- `SymbolKindNames`: Human-readable names for symbol kinds
- `FileChangeType`, `WatchKind`: File watching enums

#### 3. LSP Client (`lsp/`)

**Purpose**: Manages communication with LSP server processes.

**Components**:

##### `transport.ts` - JSON-RPC Message Transport
- Implements LSP message framing (Content-Length headers)
- Handles message serialization/deserialization
- Supports both requests and notifications

**Message Flow**:
```
Client Request → JSON-RPC → LSP Server
              ← Response ←
```

##### `client.ts` - LSP Client Implementation
- Spawns and manages LSP server process
- Handles three types of communication:
  1. **Client → Server requests**: Tool calls (definition, hover, etc.)
  2. **Server → Client requests**: Capability registration, workspace edits
  3. **Server → Client notifications**: Diagnostics, messages

**Key Methods**:
- `initialize()`: Initialize LSP server with workspace configuration
- `openFile()`: Open files for analysis
- `call()`: Make LSP requests (with response)
- `notify()`: Send LSP notifications (no response)
- `registerServerRequestHandler()`: Handle server-initiated requests
- `registerNotificationHandler()`: Handle server notifications

**Process Management**:
- Automatic process cleanup on exit
- Graceful shutdown with timeout and fallback kill
- stderr capture for logging

##### `methods.ts` - LSP Method Wrappers
Provides typed wrappers for common LSP methods:
- `symbol()`: Workspace symbol search
- `references()`: Find all references
- `hover()`: Get hover information
- `rename()`: Rename symbol
- `definition()`: Go to definition

#### 4. File Watcher (`watcher/`)

**Purpose**: Monitor workspace files and sync changes with LSP server.

**Components**:

##### `gitignore.ts` - Gitignore Matching
- Loads and parses `.gitignore` files
- Determines if files/directories should be ignored
- Uses `ignore` library for pattern matching

##### `watcher.ts` - Workspace Watcher
**Responsibilities**:
1. **File System Monitoring**: Uses `chokidar` to watch for file changes
2. **Pattern Matching**: Supports LSP glob patterns (`**/*.ts`, `*.{js,ts}`)
3. **Smart Filtering**: Excludes `node_modules`, `.git`, build artifacts
4. **Debouncing**: Reduces notification spam
5. **File Opening**: Automatically opens files matching registered patterns

**Event Flow**:
```
File Change → Filter → Debounce → Notify LSP Server
                                → Open/Close Files
```

**Configuration**:
- `excludedDirs`: Directories to skip (e.g., `node_modules`)
- `excludedFileExtensions`: File types to ignore (e.g., `.pyc`)
- `maxFileSize`: Skip large binary files
- `debounceTime`: Delay before sending notifications

#### 5. Tools (`tools/`)

**Purpose**: Implement MCP tools that expose LSP capabilities.

##### `utilities.ts` - Shared Utilities
- `addLineNumbers()`: Format code with line numbers
- `getFullDefinition()`: Expand definition to include comments/body
- `getLineRangesToDisplay()`: Calculate context ranges
- `formatLinesWithRanges()`: Format output with line ranges

##### Tool Implementations

Each tool follows a similar pattern:
1. Parse and validate inputs
2. Open necessary files in LSP
3. Call appropriate LSP methods
4. Format results for display
5. Return formatted text

**`definition.ts`** - Symbol Definition Lookup
```typescript
readDefinition(client, 'MyClass.myMethod')
→ Searches workspace symbols
→ Opens files containing matches
→ Expands definition range (includes comments)
→ Returns formatted code with location info
```

**`references.ts`** - Find All References
```typescript
findReferences(client, 'myFunction')
→ Finds symbol via workspace/symbol
→ Calls textDocument/references
→ Groups by file
→ Shows context around each reference
```

**`hover.ts`** - Get Hover Information
```typescript
getHoverInfo(client, 'file.ts', 10, 5)
→ Calls textDocument/hover
→ Formats hover content (markdown/plaintext)
→ Returns type info and documentation
```

**`diagnostics.ts`** - Get Diagnostics
```typescript
getDiagnosticsForFile(client, 'file.ts')
→ Opens file
→ Retrieves cached diagnostics
→ Groups by severity
→ Shows context around each diagnostic
```

**`edit.ts`** - Apply Text Edits
```typescript
applyTextEdits(client, 'file.ts', [
  { startLine: 10, endLine: 12, newText: 'new code' }
])
→ Opens file
→ Converts to LSP TextEdit format
→ Applies edits from bottom to top
→ Writes back to filesystem
```

**`rename.ts`** - Rename Symbol
```typescript
renameSymbol(client, 'file.ts', 10, 5, 'newName')
→ Calls textDocument/rename
→ Receives WorkspaceEdit
→ Applies changes across all files
→ Returns summary of changes
```

#### 6. Main Server (`index.ts`)

**Purpose**: Orchestrates all components and exposes MCP tools.

**Lifecycle**:
1. **Parse Configuration**: Command-line arguments (workspace, LSP command)
2. **Initialize LSP**: Start LSP server process, send initialize request
3. **Start Watcher**: Monitor workspace files
4. **Register Tools**: Define available MCP tools
5. **Start MCP Server**: Listen on stdio for MCP requests
6. **Handle Requests**: Route tool calls to appropriate handlers
7. **Graceful Shutdown**: Close files, shutdown LSP, cleanup

**Configuration Options**:
```bash
mcp-language-server \
  --workspace /path/to/project \
  --lsp typescript-language-server \
  -- --stdio
```

- `--workspace`: Project directory
- `--lsp`: LSP server command
- `--`: Arguments after this are passed to LSP server

### Data Flow

#### Tool Call Flow
```
MCP Client (LLM)
    ↓ (stdio)
MCP Server (index.ts)
    ↓
Tool Handler (tools/definition.ts)
    ↓
LSP Client (lsp/client.ts)
    ↓ (JSON-RPC over stdio)
LSP Server Process (e.g., typescript-language-server)
    ↓
File System / Code Analysis
    ↑
Results flow back up the chain
```

#### File Change Flow
```
File System Change
    ↓
chokidar (watcher.ts)
    ↓
Filter & Debounce
    ↓
LSP Client
    ↓ workspace/didChangeWatchedFiles
LSP Server
    ↓
Diagnostics Published
    ↓
Cached in LSP Client
    ↓
Available to Tools
```

## Key Design Patterns

### 1. **Layered Architecture**
- Clear separation between transport, protocol, and tool layers
- Each layer has well-defined responsibilities
- Abstractions allow for testing and modification

### 2. **Event-Driven Communication**
- LSP uses bidirectional JSON-RPC
- Server can send requests/notifications to client
- Handlers registered for different message types

### 3. **Resource Management**
- Files opened/closed explicitly
- Process cleanup on shutdown
- Timeout-based fallbacks for cleanup

### 4. **Debouncing & Caching**
- File change events debounced to reduce noise
- Diagnostics cached in client
- Open file state tracked

### 5. **Error Handling**
- Errors propagated with context
- Logging at appropriate levels
- Graceful degradation where possible

## Configuration

### Environment Variables

- `LOG_LEVEL`: Set global log level (DEBUG, INFO, WARN, ERROR, FATAL)
- `LOG_COMPONENT_LEVELS`: Set per-component levels (e.g., `lsp:DEBUG,tools:INFO`)
- `LOG_FILE`: Write logs to file in addition to stderr
- `LSP_CONTEXT_LINES`: Lines of context for references (default: 5)

### Example: Debug Mode
```bash
export LOG_LEVEL=DEBUG
mcp-language-server --workspace . --lsp gopls
```

## Testing

### Unit Tests
Focus on individual components:
- Logging configuration
- URI conversion
- Message framing/parsing
- Pattern matching
- Text edit application

### Integration Tests
Test end-to-end flows:
- LSP initialization
- File opening/closing
- Tool execution
- Workspace watching

## Extension Points

The codebase is designed for extensibility:

1. **New Tools**: Add files to `tools/` and register in `index.ts`
2. **Custom Filters**: Modify watcher configuration
3. **LSP Methods**: Add wrappers in `lsp/methods.ts`
4. **Custom Logging**: Add new components or log sinks

## Comparison with Go Version

This TypeScript implementation maintains architectural parity with the Go version while leveraging TypeScript/Node.js ecosystems:

| Aspect | Go Version | TypeScript Version |
|--------|-----------|-------------------|
| LSP Types | Generated from gopls | VSCode LSP types |
| File Watching | fsnotify | chokidar |
| Gitignore | go-gitignore | ignore |
| Concurrency | Goroutines & channels | Async/await & Promises |
| Process Management | os/exec | child_process |
| MCP SDK | mcp-go | @modelcontextprotocol/sdk |

## Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `vscode-languageserver-protocol`: LSP type definitions
- `chokidar`: File system watcher
- `ignore`: Gitignore pattern matching

## Building and Running

```bash
# Install dependencies
npm install

# Build
npm run build

# Run
node dist/index.js --workspace /path/to/project --lsp typescript-language-server -- --stdio
```

## License

BSD-3-Clause (same as original Go implementation)

