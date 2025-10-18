/**
 * LSP Client - manages communication with language server process
 */

import { spawn, ChildProcess } from 'child_process';
import { Readable, Writable } from 'stream';
import { createLogger, Component } from '../logging/logger.js';
import {
  MessageReader,
  writeMessage,
  createRequest,
  createNotification,
  createResponse,
  createErrorResponse,
  LSPMessage,
} from './transport.js';
import {
  InitializeParams,
  InitializeResult,
  InitializedParams,
  DidOpenTextDocumentParams,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidChangeWatchedFilesParams,
  TextDocumentItem,
  VersionedTextDocumentIdentifier,
  TextDocumentIdentifier,
  TextDocumentContentChangeEvent,
  Diagnostic,
  WorkspaceFolder,
  ClientCapabilities,
} from '../protocol/types.js';
import { pathToUri, uriToPath } from '../protocol/uri.js';
import * as fs from 'fs';
import * as path from 'path';

const lspLogger = createLogger(Component.LSP);
const processLogger = createLogger(Component.LSP_PROCESS);

/**
 * Handler for server-initiated requests
 */
export type ServerRequestHandler = (params: any) => Promise<any>;

/**
 * Handler for server notifications
 */
export type NotificationHandler = (params: any) => void;

/**
 * Handler for file watch registrations
 */
export type FileWatchHandler = (id: string, watchers: any[]) => void;

/**
 * Open file information
 */
interface OpenFileInfo {
  version: number;
  uri: string;
}

/**
 * Global file watch handler
 */
let fileWatchHandler: FileWatchHandler | null = null;

/**
 * Register a file watch handler
 */
export function registerFileWatchHandler(handler: FileWatchHandler): void {
  fileWatchHandler = handler;
}

/**
 * LSP Client class
 */
export class LSPClient {
  private process: ChildProcess;
  private stdin: Writable;
  private stdout: Readable;
  private stderr: Readable;
  private messageReader: MessageReader;

  private nextId = 1;
  private pendingRequests = new Map<string, (msg: LSPMessage) => void>();
  private serverRequestHandlers = new Map<string, ServerRequestHandler>();
  private notificationHandlers = new Map<string, NotificationHandler>();
  private diagnostics = new Map<string, Diagnostic[]>();
  private openFiles = new Map<string, OpenFileInfo>();

  constructor(command: string, args: string[] = []) {
    lspLogger.info('Starting LSP server: %s %s', command, args.join(' '));

    this.process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    if (!this.process.stdin || !this.process.stdout || !this.process.stderr) {
      throw new Error('Failed to create stdio pipes for LSP server');
    }

    this.stdin = this.process.stdin;
    this.stdout = this.process.stdout;
    this.stderr = this.process.stderr;
    this.messageReader = new MessageReader(this.stdout);

    // Handle stderr
    this.stderr.on('data', (chunk: Buffer) => {
      const lines = chunk.toString('utf8').split('\n');
      lines.forEach((line) => {
        if (line.trim()) {
          processLogger.info('%s', line);
        }
      });
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      lspLogger.info('LSP server exited with code %d signal %s', code, signal);
    });

    // Start message handling loop
    this.handleMessages();
  }

  /**
   * Register a handler for server-initiated requests
   */
  registerServerRequestHandler(method: string, handler: ServerRequestHandler): void {
    this.serverRequestHandlers.set(method, handler);
  }

  /**
   * Register a handler for server notifications
   */
  registerNotificationHandler(method: string, handler: NotificationHandler): void {
    this.notificationHandlers.set(method, handler);
  }

  /**
   * Initialize the LSP client
   */
  async initialize(workspaceDir: string): Promise<InitializeResult> {
    const initParams: InitializeParams = {
      processId: process.pid,
      rootPath: workspaceDir,
      rootUri: pathToUri(workspaceDir),
      workspaceFolders: [
        {
          uri: pathToUri(workspaceDir),
          name: path.basename(workspaceDir),
        } as WorkspaceFolder,
      ],
      capabilities: {
        workspace: {
          configuration: true,
          didChangeConfiguration: {
            dynamicRegistration: true,
          },
          didChangeWatchedFiles: {
            dynamicRegistration: true,
            relativePatternSupport: true,
          },
        },
        textDocument: {
          synchronization: {
            dynamicRegistration: true,
            didSave: true,
          },
          completion: {
            completionItem: {},
          },
          codeLens: {
            dynamicRegistration: true,
          },
          publishDiagnostics: {
            versionSupport: true,
          },
        },
      } as ClientCapabilities,
      clientInfo: {
        name: 'mcp-language-server',
        version: '0.0.2',
      },
      initializationOptions: {
        codelenses: {
          generate: true,
          regenerate_cgo: true,
          test: true,
          tidy: true,
          upgrade_dependency: true,
          vendor: true,
          vulncheck: false,
        },
      },
    };

    const result = await this.call<InitializeResult>('initialize', initParams);

    // Send initialized notification
    await this.notify('initialized', {} as InitializedParams);

    // Register default handlers
    this.registerServerRequestHandler('workspace/applyEdit', this.handleApplyEdit.bind(this));
    this.registerServerRequestHandler('workspace/configuration', this.handleWorkspaceConfiguration.bind(this));
    this.registerServerRequestHandler('client/registerCapability', this.handleRegisterCapability.bind(this));
    this.registerNotificationHandler('window/showMessage', this.handleServerMessage.bind(this));
    this.registerNotificationHandler('textDocument/publishDiagnostics', this.handleDiagnostics.bind(this));

    lspLogger.debug('Server capabilities: %j', result.capabilities);

    return result;
  }

  /**
   * Wait for server to be ready
   */
  async waitForServerReady(): Promise<void> {
    // TODO: Implement proper readiness detection
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  /**
   * Open a file in the LSP server
   */
  async openFile(filePath: string): Promise<void> {
    const uri = pathToUri(filePath);

    // Check if already open
    if (this.openFiles.has(uri)) {
      return;
    }

    // Read file content
    let content: string;
    try {
      content = await fs.promises.readFile(filePath, 'utf8');
    } catch (err) {
      throw new Error(`Error reading file: ${err}`);
    }

    const params: DidOpenTextDocumentParams = {
      textDocument: {
        uri,
        languageId: this.detectLanguageId(uri),
        version: 1,
        text: content,
      } as TextDocumentItem,
    };

    await this.notify('textDocument/didOpen', params);

    this.openFiles.set(uri, { version: 1, uri });
    lspLogger.debug('Opened file: %s', filePath);
  }

  /**
   * Notify server of file changes
   */
  async notifyChange(filePath: string): Promise<void> {
    const uri = pathToUri(filePath);
    const fileInfo = this.openFiles.get(uri);

    if (!fileInfo) {
      throw new Error(`Cannot notify change for unopened file: ${filePath}`);
    }

    // Read updated content
    const content = await fs.promises.readFile(filePath, 'utf8');

    // Increment version
    fileInfo.version++;

    const params: DidChangeTextDocumentParams = {
      textDocument: {
        uri,
        version: fileInfo.version,
      } as VersionedTextDocumentIdentifier,
      contentChanges: [
        {
          text: content,
        } as TextDocumentContentChangeEvent,
      ],
    };

    await this.notify('textDocument/didChange', params);
  }

  /**
   * Close a file in the LSP server
   */
  async closeFile(filePath: string): Promise<void> {
    const uri = pathToUri(filePath);

    if (!this.openFiles.has(uri)) {
      return; // Already closed
    }

    const params: DidCloseTextDocumentParams = {
      textDocument: {
        uri,
      } as TextDocumentIdentifier,
    };

    await this.notify('textDocument/didClose', params);
    this.openFiles.delete(uri);
    lspLogger.debug('Closed file: %s', filePath);
  }

  /**
   * Check if a file is open
   */
  isFileOpen(filePath: string): boolean {
    const uri = pathToUri(filePath);
    return this.openFiles.has(uri);
  }

  /**
   * Close all open files
   */
  async closeAllFiles(): Promise<void> {
    const files = Array.from(this.openFiles.keys());
    for (const uri of files) {
      const filePath = uriToPath(uri);
      try {
        await this.closeFile(filePath);
      } catch (err) {
        lspLogger.error('Error closing file %s: %s', filePath, err);
      }
    }
    lspLogger.debug('Closed %d files', files.length);
  }

  /**
   * Get diagnostics for a file
   */
  getFileDiagnostics(uri: string): Diagnostic[] {
    return this.diagnostics.get(uri) || [];
  }

  /**
   * Send a request and wait for response
   */
  async call<T = any>(method: string, params?: any): Promise<T> {
    const id = this.nextId++;
    const idStr = id.toString();

    lspLogger.debug('Making call: method=%s id=%d', method, id);

    const message = createRequest(id, method, params);

    // Create promise for response
    const responsePromise = new Promise<LSPMessage>((resolve) => {
      this.pendingRequests.set(idStr, resolve);
    });

    // Send request
    await writeMessage(this.stdin, message);

    lspLogger.debug('Waiting for response to request ID: %d', id);

    // Wait for response
    const response = await responsePromise;

    lspLogger.debug('Received response for request ID: %d', id);

    if (response.error) {
      lspLogger.error('Request failed: %s (code: %d)', response.error.message, response.error.code);
      throw new Error(`Request failed: ${response.error.message} (code: ${response.error.code})`);
    }

    return response.result as T;
  }

  /**
   * Send a notification
   */
  async notify(method: string, params?: any): Promise<void> {
    lspLogger.debug('Sending notification: method=%s', method);
    const message = createNotification(method, params);
    await writeMessage(this.stdin, message);
  }

  /**
   * Send shutdown request
   */
  async shutdown(): Promise<void> {
    lspLogger.info('Sending shutdown request');
    try {
      await this.call('shutdown');
      lspLogger.info('Shutdown request completed');
    } catch (err) {
      lspLogger.error('Shutdown request failed: %s', err);
    }
  }

  /**
   * Send exit notification
   */
  async exit(): Promise<void> {
    lspLogger.info('Sending exit notification');
    try {
      await this.notify('exit');
    } catch (err) {
      lspLogger.error('Exit notification failed: %s', err);
    }
  }

  /**
   * Close the LSP client
   */
  async close(): Promise<void> {
    lspLogger.info('Closing LSP client');

    // Close stdin
    this.stdin.end();

    // Wait for process to exit or force kill after timeout
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        lspLogger.warn('LSP process did not exit within timeout, forcing kill');
        this.process.kill('SIGKILL');
        resolve();
      }, 2000);

      this.process.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * Detect language ID from file URI
   */
  private detectLanguageId(uri: string): string {
    const ext = path.extname(uri).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.c': 'c',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.java': 'java',
      '.cs': 'csharp',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.r': 'r',
      '.R': 'r',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.fish': 'shell',
    };
    return languageMap[ext] || 'plaintext';
  }

  /**
   * Handle incoming messages
   */
  private async handleMessages(): Promise<void> {
    try {
      while (true) {
        const message = await this.messageReader.readMessage();

        // Handle server->client request
        if (message.method && message.id !== undefined) {
          this.handleServerRequest(message);
          continue;
        }

        // Handle notification
        if (message.method && message.id === undefined) {
          this.handleNotification(message);
          continue;
        }

        // Handle response
        if (message.id !== undefined && !message.method) {
          this.handleResponse(message);
          continue;
        }
      }
    } catch (err) {
      if ((err as Error).message.includes('EOF')) {
        lspLogger.info('LSP connection closed (EOF)');
      } else {
        lspLogger.error('Error reading message: %s', err);
      }
    }
  }

  /**
   * Handle server-initiated request
   */
  private async handleServerRequest(message: LSPMessage): Promise<void> {
    const handler = this.serverRequestHandlers.get(message.method!);

    let response: LSPMessage;
    if (handler) {
      lspLogger.debug('Processing server request: method=%s id=%s', message.method, message.id);
      try {
        const result = await handler(message.params);
        response = createResponse(message.id!, result);
      } catch (err) {
        lspLogger.error('Error handling server request %s: %s', message.method, err);
        response = createErrorResponse(message.id!, {
          code: -32603,
          message: (err as Error).message,
        });
      }
    } else {
      lspLogger.warn('Method not found: %s', message.method);
      response = createErrorResponse(message.id!, {
        code: -32601,
        message: `Method not found: ${message.method}`,
      });
    }

    await writeMessage(this.stdin, response);
  }

  /**
   * Handle notification
   */
  private handleNotification(message: LSPMessage): void {
    const handler = this.notificationHandlers.get(message.method!);
    if (handler) {
      lspLogger.debug('Handling notification: %s', message.method);
      handler(message.params);
    } else {
      lspLogger.debug('No handler for notification: %s', message.method);
    }
  }

  /**
   * Handle response to our request
   */
  private handleResponse(message: LSPMessage): void {
    const idStr = message.id!.toString();
    const resolver = this.pendingRequests.get(idStr);
    if (resolver) {
      lspLogger.debug('Sending response for ID %s to handler', message.id);
      this.pendingRequests.delete(idStr);
      resolver(message);
    } else {
      lspLogger.debug('No handler for response ID: %s', message.id);
    }
  }

  /**
   * Handle workspace/applyEdit request
   */
  private async handleApplyEdit(_params: any): Promise<any> {
    lspLogger.info('Received workspace/applyEdit request');
    // For now, just accept all edits
    return { applied: true };
  }

  /**
   * Handle workspace/configuration request
   */
  private async handleWorkspaceConfiguration(_params: any): Promise<any> {
    lspLogger.debug('Received workspace/configuration request: %j', _params);
    // Return empty configuration for now
    const items = _params?.items || [];
    return items.map(() => ({}));
  }

  /**
   * Handle client/registerCapability request
   */
  private async handleRegisterCapability(params: any): Promise<any> {
    lspLogger.debug('Received client/registerCapability: %j', params);

    // Handle file watcher registration
    if (params?.registrations) {
      for (const reg of params.registrations) {
        if (reg.method === 'workspace/didChangeWatchedFiles' && fileWatchHandler) {
          const watchers = reg.registerOptions?.watchers || [];
          fileWatchHandler(reg.id, watchers);
        }
      }
    }

    return null;
  }

  /**
   * Handle window/showMessage notification
   */
  private handleServerMessage(params: any): void {
    const typeNames = ['', 'Error', 'Warning', 'Info', 'Log'];
    const typeName = typeNames[params?.type] || 'Unknown';
    lspLogger.info('[LSP %s] %s', typeName, params?.message);
  }

  /**
   * Handle textDocument/publishDiagnostics notification
   */
  private handleDiagnostics(params: any): void {
    if (!params?.uri) return;

    const diagnostics = params.diagnostics || [];
    this.diagnostics.set(params.uri, diagnostics);

    if (diagnostics.length > 0) {
      lspLogger.debug('Received %d diagnostics for %s', diagnostics.length, params.uri);
    }
  }

  /**
   * Send didChangeWatchedFiles notification
   */
  async didChangeWatchedFiles(params: DidChangeWatchedFilesParams): Promise<void> {
    await this.notify('workspace/didChangeWatchedFiles', params);
  }
}

