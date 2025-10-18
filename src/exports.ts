/**
 * Public API exports
 * Use this file to import library components
 */

// Logging
export {
  createLogger,
  setLevel,
  setGlobalLevel,
  setWriter,
  setupFileLogging,
  LogLevel,
  Component,
  Logger,
} from './logging/logger.js';

// Protocol types
export * from './protocol/types.js';
export * from './protocol/uri.js';

// LSP Client
export { LSPClient, registerFileWatchHandler } from './lsp/client.js';
export * from './lsp/methods.js';
export {
  createRequest,
  createNotification,
  createResponse,
  createErrorResponse,
  writeMessage,
  MessageReader,
  LSPMessage,
  RequestId,
  ResponseError,
} from './lsp/transport.js';

// Watcher
export { WorkspaceWatcher, WatcherConfig, defaultWatcherConfig } from './watcher/watcher.js';
export { GitignoreMatcher } from './watcher/gitignore.js';

// Tools
export { readDefinition } from './tools/definition.js';
export { findReferences } from './tools/references.js';
export { getHoverInfo } from './tools/hover.js';
export { getDiagnosticsForFile } from './tools/diagnostics.js';
export { applyTextEdits, TextEdit } from './tools/edit.js';
export { renameSymbol } from './tools/rename.js';
export * from './tools/utilities.js';

