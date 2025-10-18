/**
 * Diagnostics tool - get diagnostic information for files
 */

import * as fs from 'fs';
import { LSPClient } from '../lsp/client.js';
import { pathToUri } from '../protocol/uri.js';
import { addLineNumbers } from './utilities.js';

/**
 * Get diagnostics for a file
 */
export async function getDiagnosticsForFile(
  client: LSPClient,
  filePath: string,
  contextLines: number = 5,
  showLineNumbers: boolean = true
): Promise<string> {
  const uri = pathToUri(filePath);

  try {
    await client.openFile(filePath);
  } catch (err) {
    throw new Error(`Error opening file: ${err}`);
  }

  // Wait a bit for diagnostics to be published
  await new Promise((resolve) => setTimeout(resolve, 500));

  const diagnostics = client.getFileDiagnostics(uri);

  if (diagnostics.length === 0) {
    return `No diagnostics found for ${filePath}`;
  }

  let output = `Diagnostics for ${filePath}\n`;
  output += `Total: ${diagnostics.length}\n\n`;

  // Read file content
  const content = await fs.promises.readFile(filePath, 'utf8');
  const lines = content.split('\n');

  // Group diagnostics by severity
  const severityNames = ['', 'Error', 'Warning', 'Information', 'Hint'];

  for (let i = 0; i < diagnostics.length; i++) {
    const diagnostic = diagnostics[i];
    const severity = diagnostic.severity || 1;
    const severityName = severityNames[severity] || 'Unknown';

    output += `--- Diagnostic ${i + 1} ---\n`;
    output += `Severity: ${severityName}\n`;
    output += `Location: L${diagnostic.range.start.line + 1}:C${diagnostic.range.start.character + 1}`;

    if (diagnostic.range.start.line !== diagnostic.range.end.line ||
        diagnostic.range.start.character !== diagnostic.range.end.character) {
      output += ` - L${diagnostic.range.end.line + 1}:C${diagnostic.range.end.character + 1}`;
    }

    output += `\n`;
    output += `Message: ${diagnostic.message}\n`;

    if (diagnostic.source) {
      output += `Source: ${diagnostic.source}\n`;
    }

    if (diagnostic.code) {
      output += `Code: ${diagnostic.code}\n`;
    }

    // Show context
    if (contextLines > 0) {
      output += '\nContext:\n';

      const startLine = Math.max(0, diagnostic.range.start.line - contextLines);
      const endLine = Math.min(lines.length - 1, diagnostic.range.end.line + contextLines);

      const contextText = lines.slice(startLine, endLine + 1).join('\n');

      if (showLineNumbers) {
        output += addLineNumbers(contextText, startLine + 1);
      } else {
        output += contextText;
      }

      output += '\n';
    }

    output += '\n';
  }

  return output;
}

