/**
 * LSP Protocol types
 * Re-exports and extends types from vscode-languageserver-protocol
 */

export * from 'vscode-languageserver-protocol';
export * from 'vscode-languageserver-types';
export { URI } from 'vscode-uri';

import {
  Location,
  SymbolInformation,
  WorkspaceSymbol,
  SymbolKind,
} from 'vscode-languageserver-types';

/**
 * Symbol result interface - handles both SymbolInformation and WorkspaceSymbol
 */
export interface ISymbol {
  getName(): string;
  getLocation(): Location;
}

/**
 * Wrapper for SymbolInformation
 */
export class SymbolInformationWrapper implements ISymbol {
  constructor(private symbol: SymbolInformation) {}

  getName(): string {
    return this.symbol.name;
  }

  getLocation(): Location {
    return this.symbol.location;
  }

  get kind(): SymbolKind {
    return this.symbol.kind;
  }

  get containerName(): string | undefined {
    return this.symbol.containerName;
  }
}

/**
 * Wrapper for WorkspaceSymbol
 */
export class WorkspaceSymbolWrapper implements ISymbol {
  constructor(private symbol: WorkspaceSymbol) {}

  getName(): string {
    return this.symbol.name;
  }

  getLocation(): Location {
    const location = this.symbol.location;
    if ('range' in location) {
      // It's a Location
      return location as Location;
    } else {
      // It's a { uri: DocumentUri } - we need to construct a Location
      return {
        uri: (location as any).uri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
      };
    }
  }

  get kind(): SymbolKind {
    return this.symbol.kind;
  }
}

/**
 * Wrap a symbol into ISymbol interface
 */
export function wrapSymbol(symbol: SymbolInformation | WorkspaceSymbol): ISymbol {
  if ('location' in symbol && 'uri' in (symbol.location as any)) {
    // SymbolInformation
    return new SymbolInformationWrapper(symbol as SymbolInformation);
  } else {
    // WorkspaceSymbol
    return new WorkspaceSymbolWrapper(symbol as WorkspaceSymbol);
  }
}

/**
 * Symbol kind names mapping
 */
export const SymbolKindNames: Record<SymbolKind, string> = {
  [SymbolKind.File]: 'File',
  [SymbolKind.Module]: 'Module',
  [SymbolKind.Namespace]: 'Namespace',
  [SymbolKind.Package]: 'Package',
  [SymbolKind.Class]: 'Class',
  [SymbolKind.Method]: 'Method',
  [SymbolKind.Property]: 'Property',
  [SymbolKind.Field]: 'Field',
  [SymbolKind.Constructor]: 'Constructor',
  [SymbolKind.Enum]: 'Enum',
  [SymbolKind.Interface]: 'Interface',
  [SymbolKind.Function]: 'Function',
  [SymbolKind.Variable]: 'Variable',
  [SymbolKind.Constant]: 'Constant',
  [SymbolKind.String]: 'String',
  [SymbolKind.Number]: 'Number',
  [SymbolKind.Boolean]: 'Boolean',
  [SymbolKind.Array]: 'Array',
  [SymbolKind.Object]: 'Object',
  [SymbolKind.Key]: 'Key',
  [SymbolKind.Null]: 'Null',
  [SymbolKind.EnumMember]: 'EnumMember',
  [SymbolKind.Struct]: 'Struct',
  [SymbolKind.Event]: 'Event',
  [SymbolKind.Operator]: 'Operator',
  [SymbolKind.TypeParameter]: 'TypeParameter',
};

/**
 * File change types for file watching
 */
export enum FileChangeType {
  Created = 1,
  Changed = 2,
  Deleted = 3,
}

/**
 * Watch kinds for file watching
 */
export enum WatchKind {
  Create = 1,
  Change = 2,
  Delete = 4,
}

