/**
 * References tool - find all usages of symbols
 */

import * as fs from 'fs';
import { LSPClient } from '../lsp/client.js';
import { symbol, references as lspReferences } from '../lsp/methods.js';
import { createLogger, Component } from '../logging/logger.js';
import {
  wrapSymbol,
  WorkspaceSymbolParams,
  ReferenceParams,
  TextDocumentPositionParams,
  TextDocumentIdentifier,
  ReferenceContext,
  Location,
} from '../protocol/types.js';
import { uriToPath } from '../protocol/uri.js';
import {
  getLineRangesToDisplay,
  convertLinesToRanges,
  formatLinesWithRanges,
} from './utilities.js';

const toolsLogger = createLogger(Component.TOOLS);

/**
 * Find references to a symbol
 */
export async function findReferences(
  client: LSPClient,
  symbolName: string
): Promise<string> {
  // Get context lines from environment variable
  const contextLines = parseInt(process.env.LSP_CONTEXT_LINES || '5', 10);

  // First get the symbol location (caching is now handled in methods.ts)
  toolsLogger.debug('Querying for symbols: %s', symbolName);
  const symbolResult = await symbol(client, { query: symbolName } as WorkspaceSymbolParams);
  const results = symbolResult.results();

  const allReferences: string[] = [];

  for (const rawSymbol of results) {
    const sym = wrapSymbol(rawSymbol);

    // Handle different matching strategies
    if (symbolName.includes('.')) {
      const parts = symbolName.split('.');
      const methodName = parts[parts.length - 1];

      // Try matching the unqualified method name
      if (sym.getName() !== symbolName && sym.getName() !== methodName) {
        continue;
      }
    } else if (sym.getName() !== symbolName) {
      continue;
    }

    // Get the location of the symbol
    const loc = sym.getLocation();
    const filePath = uriToPath(loc.uri);

    // Open the file
    try {
      await client.openFile(filePath);
    } catch (err) {
      toolsLogger.error('Error opening file: %s', err);
      continue;
    }

    // Use LSP references request
    const refsParams: ReferenceParams = {
      textDocument: { uri: loc.uri } as TextDocumentIdentifier,
      position: loc.range.start,
      context: { includeDeclaration: false } as ReferenceContext,
    } as ReferenceParams & TextDocumentPositionParams;

    const refs = await lspReferences(client, refsParams);

    // Group references by file
    const refsByFile = new Map<string, Location[]>();
    for (const ref of refs) {
      const uri = ref.uri;
      if (!refsByFile.has(uri)) {
        refsByFile.set(uri, []);
      }
      refsByFile.get(uri)!.push(ref);
    }

    // Get sorted list of URIs
    const uris = Array.from(refsByFile.keys()).sort();

    // Process each file's references
    for (const uri of uris) {
      const fileRefs = refsByFile.get(uri)!;
      const refFilePath = uriToPath(uri);

      // Format file header
      let fileInfo = `---\n\n${refFilePath}\nReferences in File: ${fileRefs.length}\n`;

      // Format locations with context
      try {
        const fileContent = await fs.promises.readFile(refFilePath, 'utf8');
        const lines = fileContent.split('\n');

        // Track reference locations for header display
        const locStrings = fileRefs.map(
          (ref) => `L${ref.range.start.line + 1}:C${ref.range.start.character + 1}`
        );

        // Collect lines to display
        const linesToShow = getLineRangesToDisplay(fileRefs, lines.length, contextLines);

        // Convert to line ranges
        const lineRanges = convertLinesToRanges(linesToShow, lines.length);

        // Format output
        let formattedOutput = fileInfo;
        if (locStrings.length > 0) {
          formattedOutput += 'At: ' + locStrings.join(', ') + '\n';
        }

        formattedOutput += '\n' + formatLinesWithRanges(lines, lineRanges);
        allReferences.push(formattedOutput);
      } catch (err) {
        allReferences.push(fileInfo + '\nError reading file: ' + err);
      }
    }
  }

  if (allReferences.length === 0) {
    return `No references found for symbol: ${symbolName}`;
  }

  return allReferences.join('\n');
}

