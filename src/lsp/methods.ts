/**
 * LSP Methods - wrapper functions for LSP protocol methods
 * All methods include caching to improve performance
 */

import { LSPClient } from './client.js';
import {
  WorkspaceSymbolParams,
  ReferenceParams,
  HoverParams,
  RenameParams,
  DefinitionParams,
  Location,
  Hover,
  WorkspaceEdit,
  SymbolInformation,
  WorkspaceSymbol,
} from '../protocol/types.js';
import { uriToPath } from '../protocol/uri.js';
import { createLogger, Component } from '../logging/logger.js';

const methodsLogger = createLogger(Component.LSP);

/**
 * Symbol result wrapper
 */
export class SymbolResult {
  constructor(private symbols: (SymbolInformation | WorkspaceSymbol)[]) {}

  results(): (SymbolInformation | WorkspaceSymbol)[] {
    return this.symbols;
  }
}

/**
 * Request workspace symbols with caching
 */
export async function symbol(client: LSPClient, params: WorkspaceSymbolParams): Promise<SymbolResult> {
  const cacheManager = client.getCacheManager();
  const query = params.query || '';

  // Check cache first
  const cachedSymbols = cacheManager.getWorkspaceSymbols(query);
  if (cachedSymbols !== null) {
    methodsLogger.debug('Cache hit for workspace symbols: %s', query);
    return new SymbolResult(cachedSymbols);
  }

  // Cache miss - query LSP
  methodsLogger.debug('Cache miss for workspace symbols: %s', query);
  const result = await client.call<(SymbolInformation | WorkspaceSymbol)[] | null>('workspace/symbol', params);
  const symbols = result || [];

  // Cache the result
  cacheManager.setWorkspaceSymbols(query, symbols);

  return new SymbolResult(symbols);
}

/**
 * Request references with caching
 */
export async function references(client: LSPClient, params: ReferenceParams): Promise<Location[]> {
  const cacheManager = client.getCacheManager();
  const filePath = uriToPath(params.textDocument.uri);
  const line = params.position.line;
  const character = params.position.character;

  // Check cache first
  const cachedRefs = cacheManager.getReferences(filePath, line, character);
  if (cachedRefs !== null) {
    methodsLogger.debug('Cache hit for references: %s:%d:%d', filePath, line, character);
    return cachedRefs;
  }

  // Cache miss - query LSP
  methodsLogger.debug('Cache miss for references: %s:%d:%d', filePath, line, character);
  const result = await client.call<Location[] | null>('textDocument/references', params);
  const locations = result || [];

  // Cache the result
  cacheManager.setReferences(filePath, line, character, locations);

  return locations;
}

/**
 * Request hover information with caching
 */
export async function hover(client: LSPClient, params: HoverParams): Promise<Hover | null> {
  const cacheManager = client.getCacheManager();
  const filePath = uriToPath(params.textDocument.uri);
  const line = params.position.line;
  const character = params.position.character;

  // Check cache first
  const cachedHover = cacheManager.getHover(filePath, line, character);
  if (cachedHover !== undefined) {
    methodsLogger.debug('Cache hit for hover: %s:%d:%d', filePath, line, character);
    return cachedHover;
  }

  // Cache miss - query LSP
  methodsLogger.debug('Cache miss for hover: %s:%d:%d', filePath, line, character);
  const result = await client.call<Hover | null>('textDocument/hover', params);

  // Cache the result (even if null)
  cacheManager.setHover(filePath, line, character, result);

  return result;
}

/**
 * Request rename (no caching - modifies state)
 */
export async function rename(client: LSPClient, params: RenameParams): Promise<WorkspaceEdit | null> {
  // Rename operations modify state, so they should not be cached
  const result = await client.call<WorkspaceEdit | null>('textDocument/rename', params);
  return result;
}

/**
 * Request definition with caching
 */
export async function definition(client: LSPClient, params: DefinitionParams): Promise<Location | Location[] | null> {
  const cacheManager = client.getCacheManager();
  const filePath = uriToPath(params.textDocument.uri);
  const line = params.position.line;
  const character = params.position.character;

  // Check cache first
  const cachedDefs = cacheManager.getDefinitions(filePath, line, character);
  if (cachedDefs !== null) {
    methodsLogger.debug('Cache hit for definitions: %s:%d:%d', filePath, line, character);
    // Return the cached result in the same format as LSP (single Location or array)
    if (cachedDefs.length === 0) {
      return null;
    } else if (cachedDefs.length === 1) {
      return cachedDefs[0];
    } else {
      return cachedDefs;
    }
  }

  // Cache miss - query LSP
  methodsLogger.debug('Cache miss for definitions: %s:%d:%d', filePath, line, character);
  const result = await client.call<Location | Location[] | null>('textDocument/definition', params);

  // Normalize result to array for caching
  let locations: Location[] = [];
  if (result) {
    if (Array.isArray(result)) {
      locations = result;
    } else {
      locations = [result];
    }
  }

  // Cache the result
  cacheManager.setDefinitions(filePath, line, character, locations);

  return result;
}

