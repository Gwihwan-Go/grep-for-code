/**
 * LSP Methods - wrapper functions for LSP protocol methods
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
 * Request workspace symbols
 */
export async function symbol(client: LSPClient, params: WorkspaceSymbolParams): Promise<SymbolResult> {
  const result = await client.call<(SymbolInformation | WorkspaceSymbol)[] | null>('workspace/symbol', params);
  return new SymbolResult(result || []);
}

/**
 * Request references
 */
export async function references(client: LSPClient, params: ReferenceParams): Promise<Location[]> {
  const result = await client.call<Location[] | null>('textDocument/references', params);
  return result || [];
}

/**
 * Request hover information
 */
export async function hover(client: LSPClient, params: HoverParams): Promise<Hover | null> {
  const result = await client.call<Hover | null>('textDocument/hover', params);
  return result;
}

/**
 * Request rename
 */
export async function rename(client: LSPClient, params: RenameParams): Promise<WorkspaceEdit | null> {
  const result = await client.call<WorkspaceEdit | null>('textDocument/rename', params);
  return result;
}

/**
 * Request definition
 */
export async function definition(client: LSPClient, params: DefinitionParams): Promise<Location | Location[] | null> {
  const result = await client.call<Location | Location[] | null>('textDocument/definition', params);
  return result;
}

