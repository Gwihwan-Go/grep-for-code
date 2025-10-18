/**
 * Edit tool - apply text edits to files
 */

import * as fs from 'fs';
import { LSPClient } from '../lsp/client.js';
import { WorkspaceEdit, TextEdit as LSPTextEdit, Range, Position } from '../protocol/types.js';
import { pathToUri } from '../protocol/uri.js';

/**
 * Text edit input format
 */
export interface TextEdit {
  startLine: number;
  endLine: number;
  newText: string;
}

/**
 * Apply text edits to a file
 */
export async function applyTextEdits(
  client: LSPClient,
  filePath: string,
  edits: TextEdit[]
): Promise<string> {
  const uri = pathToUri(filePath);

  try {
    await client.openFile(filePath);
  } catch (err) {
    throw new Error(`Could not open file: ${err}`);
  }

  // Sort edits for reporting (ascending order)
  const sortedEdits = [...edits].sort((a, b) => a.startLine - b.startLine);

  // Track lines added and removed
  let linesRemoved = 0;
  let linesAdded = 0;

  for (const edit of sortedEdits) {
    const removedLineCount = edit.endLine - edit.startLine + 1;
    linesRemoved += removedLineCount;

    let addedLineCount = 1;
    if (edit.newText !== '') {
      addedLineCount = edit.newText.split('\n').length;
    } else {
      addedLineCount = 0;
    }
    linesAdded += addedLineCount;
  }

  // Convert to LSP text edits
  // Sort in descending order to process from bottom to top
  const descendingEdits = [...edits].sort((a, b) => b.startLine - a.startLine);

  const lspEdits: LSPTextEdit[] = [];

  for (const edit of descendingEdits) {
    const range = await getRange(filePath, edit.startLine, edit.endLine);
    lspEdits.push({
      range,
      newText: edit.newText,
    } as LSPTextEdit);
  }

  // Apply the edits using workspace edit
  const workspaceEdit: WorkspaceEdit = {
    changes: {
      [uri]: lspEdits,
    },
  };

  await applyWorkspaceEdit(workspaceEdit);

  return `Successfully applied text edits. ${linesRemoved} lines removed, ${linesAdded} lines added.`;
}

/**
 * Get range for line numbers
 */
async function getRange(filePath: string, startLine: number, endLine: number): Promise<Range> {
  const content = await fs.promises.readFile(filePath, 'utf8');

  // Detect line ending style
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(lineEnding);

  // Validate start line
  if (startLine < 1) {
    throw new Error(`Start line must be >= 1, got ${startLine}`);
  }

  // Convert to 0-based line numbers
  const startIdx = startLine - 1;
  let endIdx = endLine - 1;

  // Handle EOF positioning
  if (startIdx >= lines.length) {
    let lastContentLineIdx = lines.length - 1;
    if (lastContentLineIdx >= 0 && lines[lastContentLineIdx] === '') {
      lastContentLineIdx--;
    }

    if (lastContentLineIdx < 0) {
      lastContentLineIdx = 0;
    }

    const pos: Position = {
      line: lastContentLineIdx,
      character: lines[lastContentLineIdx]?.length || 0,
    };

    return {
      start: pos,
      end: pos,
    } as Range;
  }

  // Normal range handling
  if (endIdx >= lines.length) {
    endIdx = lines.length - 1;
  }

  return {
    start: {
      line: startIdx,
      character: 0, // Always start at beginning of line
    } as Position,
    end: {
      line: endIdx,
      character: lines[endIdx]?.length || 0, // Go to end of last line
    } as Position,
  } as Range;
}

/**
 * Apply workspace edit
 */
async function applyWorkspaceEdit(edit: WorkspaceEdit): Promise<void> {
  if (!edit.changes) {
    return;
  }

  for (const [uri, edits] of Object.entries(edit.changes)) {
    const filePath = uri.replace('file://', '');
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

