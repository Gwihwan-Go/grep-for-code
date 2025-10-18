/**
 * Rename tool - rename symbols across the codebase
 */

import * as fs from 'fs';
import { LSPClient } from '../lsp/client.js';
import { rename as lspRename } from '../lsp/methods.js';
import { createLogger, Component } from '../logging/logger.js';
import {
  RenameParams,
  TextDocumentIdentifier,
  Position,
  WorkspaceEdit,
} from '../protocol/types.js';
import { pathToUri, uriToPath } from '../protocol/uri.js';

const toolsLogger = createLogger(Component.TOOLS);

/**
 * Rename a symbol
 */
export async function renameSymbol(
  client: LSPClient,
  filePath: string,
  line: number,
  column: number,
  newName: string
): Promise<string> {
  const uri = pathToUri(filePath);

  try {
    await client.openFile(filePath);
  } catch (err) {
    throw new Error(`Error opening file: ${err}`);
  }

  const params: RenameParams = {
    textDocument: { uri } as TextDocumentIdentifier,
    position: {
      line: line - 1, // Convert from 1-indexed to 0-indexed
      character: column - 1,
    } as Position,
    newName,
  };

  toolsLogger.debug('Requesting rename for file: %s line: %d column: %d newName: %s',
    filePath, line, column, newName);

  const workspaceEdit = await lspRename(client, params);

  if (!workspaceEdit || !workspaceEdit.changes || Object.keys(workspaceEdit.changes).length === 0) {
    return `No rename operations available at ${filePath}:${line}:${column}`;
  }

  // Apply the workspace edit
  await applyWorkspaceEdit(workspaceEdit);

  // Count changes
  let totalChanges = 0;
  const fileChanges = new Map<string, number>();

  for (const [uri, edits] of Object.entries(workspaceEdit.changes)) {
    const filePath = uriToPath(uri);
    fileChanges.set(filePath, edits.length);
    totalChanges += edits.length;
  }

  // Format output
  let output = `Successfully renamed symbol to '${newName}'\n`;
  output += `Total changes: ${totalChanges} across ${fileChanges.size} file(s)\n\n`;

  for (const [file, count] of fileChanges.entries()) {
    output += `  ${file}: ${count} change(s)\n`;
  }

  return output;
}

/**
 * Apply workspace edit
 */
async function applyWorkspaceEdit(edit: WorkspaceEdit): Promise<void> {
  if (!edit.changes) {
    return;
  }

  for (const [uri, edits] of Object.entries(edit.changes)) {
    const filePath = uriToPath(uri);
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');

    // Sort edits in descending order
    const sortedEdits = [...edits].sort((a, b) => {
      if (b.range.start.line !== a.range.start.line) {
        return b.range.start.line - a.range.start.line;
      }
      return b.range.start.character - a.range.start.character;
    });

    // Apply edits from bottom to top
    for (const edit of sortedEdits) {
      const startLine = edit.range.start.line;
      const startChar = edit.range.start.character;
      const endLine = edit.range.end.line;
      const endChar = edit.range.end.character;

      // Handle single line edit
      if (startLine === endLine) {
        const line = lines[startLine];
        lines[startLine] = line.substring(0, startChar) + edit.newText + line.substring(endChar);
      } else {
        // Multi-line edit
        const startLineText = lines[startLine].substring(0, startChar);
        const endLineText = lines[endLine].substring(endChar);
        const newText = startLineText + edit.newText + endLineText;

        // Replace lines
        lines.splice(startLine, endLine - startLine + 1, newText);
      }
    }

    // Write back to file
    await fs.promises.writeFile(filePath, lines.join('\n'), 'utf8');
  }
}

