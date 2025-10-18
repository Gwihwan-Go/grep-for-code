/**
 * Hover tool - get hover information for symbols
 */

import { LSPClient } from '../lsp/client.js';
import { hover as lspHover } from '../lsp/methods.js';
import { createLogger, Component } from '../logging/logger.js';
import { HoverParams, TextDocumentIdentifier, Position } from '../protocol/types.js';
import { pathToUri } from '../protocol/uri.js';

const toolsLogger = createLogger(Component.TOOLS);

/**
 * Get hover information
 */
export async function getHoverInfo(
  client: LSPClient,
  filePath: string,
  line: number,
  column: number
): Promise<string> {
  const uri = pathToUri(filePath);

  try {
    await client.openFile(filePath);
  } catch (err) {
    throw new Error(`Error opening file: ${err}`);
  }

  const params: HoverParams = {
    textDocument: { uri } as TextDocumentIdentifier,
    position: {
      line: line - 1, // Convert from 1-indexed to 0-indexed
      character: column - 1,
    } as Position,
  };

  toolsLogger.debug('Requesting hover for file: %s line: %d column: %d', filePath, line, column);

  const hoverResult = await lspHover(client, params);

  if (!hoverResult || !hoverResult.contents) {
    return `No hover information available at ${filePath}:${line}:${column}`;
  }

  // Format the hover contents
  let output = `Hover information for ${filePath}:${line}:${column}\n\n`;

  const contents = hoverResult.contents;

  if (typeof contents === 'string') {
    output += contents;
  } else if (Array.isArray(contents)) {
    output += contents.map((item: any) => {
      if (typeof item === 'string') {
        return item;
      } else if ('language' in item) {
        return `\`\`\`${item.language}\n${item.value}\n\`\`\``;
      } else {
        return item.value;
      }
    }).join('\n\n');
  } else if (typeof contents === 'object' && contents !== null) {
    const obj = contents as any;
    if ('kind' in obj) {
      if (obj.kind === 'plaintext') {
        output += obj.value;
      } else if (obj.kind === 'markdown') {
        output += obj.value;
      }
    } else if ('language' in obj) {
      output += `\`\`\`${obj.language}\n${obj.value}\n\`\`\``;
    } else if ('value' in obj) {
      output += obj.value;
    }
  }

  return output;
}

