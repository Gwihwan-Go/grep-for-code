#!/usr/bin/env node

/**
 * MCP Language Server - Main entry point
 * Wraps Language Server Protocol (LSP) servers and exposes them via MCP
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';
import * as fs from 'fs';
import { createLogger, Component } from './logging/logger.js';
import { LSPClient } from './lsp/client.js';
import { WorkspaceWatcher } from './watcher/watcher.js';
import { readDefinition } from './tools/definition.js';
import { findReferences } from './tools/references.js';
import { getHoverInfo } from './tools/hover.js';
import { getDiagnosticsForFile } from './tools/diagnostics.js';
import { applyTextEdits, TextEdit } from './tools/edit.js';
import { renameSymbol } from './tools/rename.js';

const coreLogger = createLogger(Component.CORE);

/**
 * Configuration
 */
interface Config {
  workspaceDir: string;
  lspCommand: string;
  lspArgs: string[];
}

/**
 * Parse command line arguments
 */
function parseConfig(): Config {
  const args = process.argv.slice(2);

  let workspaceDir = '';
  let lspCommand = '';
  const lspArgs: string[] = [];

  let i = 0;
  let foundDash = false;

  while (i < args.length) {
    if (args[i] === '--workspace') {
      workspaceDir = args[i + 1];
      i += 2;
    } else if (args[i] === '--lsp') {
      lspCommand = args[i + 1];
      i += 2;
    } else if (args[i] === '--') {
      foundDash = true;
      i++;
      break;
    } else {
      i++;
    }
  }

  // Remaining args after -- are LSP arguments
  if (foundDash) {
    lspArgs.push(...args.slice(i));
  }

  // Validate
  if (!workspaceDir) {
    throw new Error('workspace directory is required (--workspace <dir>)');
  }

  if (!lspCommand) {
    throw new Error('LSP command is required (--lsp <command>)');
  }

  // Get absolute path
  workspaceDir = path.resolve(workspaceDir);

  if (!fs.existsSync(workspaceDir)) {
    throw new Error(`workspace directory does not exist: ${workspaceDir}`);
  }

  return { workspaceDir, lspCommand, lspArgs };
}

/**
 * Main MCP server class
 */
class MCPLanguageServer {
  private server: Server;
  private lspClient?: LSPClient;
  private workspaceWatcher?: WorkspaceWatcher;

  constructor(private config: Config) {
    this.server = new Server(
      {
        name: 'MCP Language Server',
        version: '0.0.2',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'definition',
            description: 'Read the source code definition of a symbol (function, type, constant, etc.) from the codebase. Returns the complete implementation code where the symbol is defined.',
            inputSchema: {
              type: 'object',
              properties: {
                symbolName: {
                  type: 'string',
                  description: 'The name of the symbol whose definition you want to find (e.g. \'mypackage.MyFunction\', \'MyType.MyMethod\')',
                },
              },
              required: ['symbolName'],
            },
          },
          {
            name: 'references',
            description: 'Find all usages and references of a symbol throughout the codebase. Returns a list of all files and locations where the symbol appears.',
            inputSchema: {
              type: 'object',
              properties: {
                symbolName: {
                  type: 'string',
                  description: 'The name of the symbol to search for (e.g. \'mypackage.MyFunction\', \'MyType\')',
                },
              },
              required: ['symbolName'],
            },
          },
          {
            name: 'diagnostics',
            description: 'Get diagnostic information for a specific file from the language server.',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'The path to the file to get diagnostics for',
                },
                contextLines: {
                  type: 'number',
                  description: 'Lines to include around each diagnostic.',
                  default: 5,
                },
                showLineNumbers: {
                  type: 'boolean',
                  description: 'If true, adds line numbers to the output',
                  default: true,
                },
              },
              required: ['filePath'],
            },
          },
          {
            name: 'hover',
            description: 'Get hover information (type, documentation) for a symbol at the specified position.',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'The path to the file to get hover information for',
                },
                line: {
                  type: 'number',
                  description: 'The line number where the hover is requested (1-indexed)',
                },
                column: {
                  type: 'number',
                  description: 'The column number where the hover is requested (1-indexed)',
                },
              },
              required: ['filePath', 'line', 'column'],
            },
          },
          {
            name: 'rename_symbol',
            description: 'Rename a symbol (variable, function, class, etc.) at the specified position and update all references throughout the codebase.',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'The path to the file containing the symbol to rename',
                },
                line: {
                  type: 'number',
                  description: 'The line number where the symbol is located (1-indexed)',
                },
                column: {
                  type: 'number',
                  description: 'The column number where the symbol is located (1-indexed)',
                },
                newName: {
                  type: 'string',
                  description: 'The new name for the symbol',
                },
              },
              required: ['filePath', 'line', 'column', 'newName'],
            },
          },
          {
            name: 'edit_file',
            description: 'Apply multiple text edits to a file.',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'Path to the file to edit',
                },
                edits: {
                  type: 'array',
                  description: 'List of edits to apply',
                  items: {
                    type: 'object',
                    properties: {
                      startLine: {
                        type: 'number',
                        description: 'Start line to replace, inclusive, one-indexed',
                      },
                      endLine: {
                        type: 'number',
                        description: 'End line to replace, inclusive, one-indexed',
                      },
                      newText: {
                        type: 'string',
                        description: 'Replacement text. Replace with the new text. Leave blank to remove lines.',
                      },
                    },
                    required: ['startLine', 'endLine'],
                  },
                },
              },
              required: ['filePath', 'edits'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.lspClient) {
        throw new Error('LSP client not initialized');
      }

      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'definition': {
            const symbolName = args?.symbolName as string;
            if (!symbolName) {
              throw new Error('symbolName is required');
            }
            coreLogger.debug('Executing definition for symbol: %s', symbolName);
            const result = await readDefinition(this.lspClient, symbolName);
            return { content: [{ type: 'text', text: result }] };
          }

          case 'references': {
            const symbolName = args?.symbolName as string;
            if (!symbolName) {
              throw new Error('symbolName is required');
            }
            coreLogger.debug('Executing references for symbol: %s', symbolName);
            const result = await findReferences(this.lspClient, symbolName);
            return { content: [{ type: 'text', text: result }] };
          }

          case 'diagnostics': {
            const filePath = args?.filePath as string;
            if (!filePath) {
              throw new Error('filePath is required');
            }
            const contextLines = (args?.contextLines as number) ?? 5;
            const showLineNumbers = (args?.showLineNumbers as boolean) ?? true;
            coreLogger.debug('Executing diagnostics for file: %s', filePath);
            const result = await getDiagnosticsForFile(
              this.lspClient,
              filePath,
              contextLines,
              showLineNumbers
            );
            return { content: [{ type: 'text', text: result }] };
          }

          case 'hover': {
            const filePath = args?.filePath as string;
            const line = args?.line as number;
            const column = args?.column as number;
            if (!filePath || !line || !column) {
              throw new Error('filePath, line, and column are required');
            }
            coreLogger.debug('Executing hover for file: %s line: %d column: %d', filePath, line, column);
            const result = await getHoverInfo(this.lspClient, filePath, line, column);
            return { content: [{ type: 'text', text: result }] };
          }

          case 'rename_symbol': {
            const filePath = args?.filePath as string;
            const line = args?.line as number;
            const column = args?.column as number;
            const newName = args?.newName as string;
            if (!filePath || !line || !column || !newName) {
              throw new Error('filePath, line, column, and newName are required');
            }
            coreLogger.debug('Executing rename_symbol for file: %s line: %d column: %d newName: %s',
              filePath, line, column, newName);
            const result = await renameSymbol(this.lspClient, filePath, line, column, newName);
            return { content: [{ type: 'text', text: result }] };
          }

          case 'edit_file': {
            const filePath = args?.filePath as string;
            const edits = args?.edits as TextEdit[];
            if (!filePath || !edits) {
              throw new Error('filePath and edits are required');
            }
            coreLogger.debug('Executing edit_file for file: %s', filePath);
            const result = await applyTextEdits(this.lspClient, filePath, edits);
            return { content: [{ type: 'text', text: result }] };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (err) {
        coreLogger.error('Failed to execute tool %s: %s', name, err);
        throw err;
      }
    });
  }

  /**
   * Initialize LSP client and start server
   */
  async start(): Promise<void> {
    coreLogger.info('MCP Language Server starting');

    // Change to workspace directory
    process.chdir(this.config.workspaceDir);

    // Create LSP client
    this.lspClient = new LSPClient(this.config.lspCommand, this.config.lspArgs);

    // Initialize LSP
    const initResult = await this.lspClient.initialize(this.config.workspaceDir);
    coreLogger.debug('Server capabilities: %j', initResult.capabilities);

    // Create workspace watcher
    this.workspaceWatcher = new WorkspaceWatcher(this.lspClient);

    // Start watching workspace
    await this.workspaceWatcher.watchWorkspace(this.config.workspaceDir);

    // Wait for server to be ready
    await this.lspClient.waitForServerReady();

    // Setup signal handlers
    this.setupSignalHandlers();

    // Start MCP server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    coreLogger.info('MCP Language Server running');
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const cleanup = async () => {
      coreLogger.info('Cleanup initiated');

      // Close all files
      if (this.lspClient) {
        coreLogger.info('Closing open files');
        await this.lspClient.closeAllFiles();

        // Send shutdown and exit
        coreLogger.info('Sending shutdown request');
        await this.lspClient.shutdown();

        coreLogger.info('Sending exit notification');
        await this.lspClient.exit();

        coreLogger.info('Closing LSP client');
        await this.lspClient.close();
      }

      // Stop watcher
      if (this.workspaceWatcher) {
        await this.workspaceWatcher.stop();
      }

      coreLogger.info('Cleanup completed');
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const config = parseConfig();
    const server = new MCPLanguageServer(config);
    await server.start();
  } catch (err) {
    coreLogger.fatal('%s', err);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

