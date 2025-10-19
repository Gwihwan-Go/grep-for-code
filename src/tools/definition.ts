/**
 * Definition tool - read source code definition of symbols
 */

import { LSPClient } from '../lsp/client.js';
import { symbol } from '../lsp/methods.js';
import { createLogger, Component } from '../logging/logger.js';
import { wrapSymbol, SymbolKind, SymbolKindNames, WorkspaceSymbolParams } from '../protocol/types.js';
import { uriToPath } from '../protocol/uri.js';
import { addLineNumbers, getFullDefinition } from './utilities.js';

const toolsLogger = createLogger(Component.TOOLS);

/**
 * Read definition of a symbol
 */
export async function readDefinition(
  client: LSPClient,
  symbolName: string
): Promise<string> {
  // Query symbols (caching is now handled in methods.ts)
  toolsLogger.debug('Querying for symbols: %s', symbolName);
  const symbolResult = await symbol(client, { query: symbolName } as WorkspaceSymbolParams);
  const results = symbolResult.results();

  const definitions: string[] = [];

  for (const rawSymbol of results) {
    const sym = wrapSymbol(rawSymbol);

    // Skip symbols that we are not looking for
    const symWrapper = sym as any;
    const kind = symWrapper.kind;
    const containerName = symWrapper.containerName;

    // Handle different matching strategies
    if (symbolName.includes('.')) {
      // For qualified names like "Type.Method", require exact match
      if (sym.getName() !== symbolName) {
        continue;
      }
    } else {
      // For unqualified names
      if (kind === SymbolKind.Method) {
        // For methods, match if it ends with ::symbolName or .symbolName or equals symbolName
        if (
          !sym.getName().endsWith(`::${symbolName}`) &&
          !sym.getName().endsWith(`.${symbolName}`) &&
          sym.getName() !== symbolName
        ) {
          continue;
        }
      } else if (sym.getName() !== symbolName) {
        // For non-methods, exact match only
        continue;
      }
    }

    toolsLogger.debug('Found symbol: %s', sym.getName());

    const loc = sym.getLocation();
    const filePath = uriToPath(loc.uri);

    try {
      await client.openFile(filePath);
    } catch (err) {
      toolsLogger.error('Error opening file: %s', err);
      continue;
    }

    const banner = '---\n\n';
    let [definition, updatedLoc] = await getFullDefinition(filePath, loc);

    const kindStr = kind !== undefined ? `Kind: ${SymbolKindNames[kind as SymbolKind]}\n` : '';
    const containerStr = containerName ? `Container Name: ${containerName}\n` : '';

    const locationInfo =
      `Symbol: ${sym.getName()}\n` +
      `File: ${filePath}\n` +
      kindStr +
      containerStr +
      `Range: L${updatedLoc.range.start.line + 1}:C${updatedLoc.range.start.character + 1} - ` +
      `L${updatedLoc.range.end.line + 1}:C${updatedLoc.range.end.character + 1}\n\n`;

    definition = addLineNumbers(definition, updatedLoc.range.start.line + 1);

    definitions.push(banner + locationInfo + definition + '\n');
  }

  if (definitions.length === 0) {
    return `${symbolName} not found`;
  }

  return definitions.join('');
}

