/**
 * Utility functions for tools
 */

import * as fs from 'fs';
import { Location } from '../protocol/types.js';

/**
 * Add line numbers to text
 */
export function addLineNumbers(text: string, startLine: number): string {
  const lines = text.split('\n');
  return lines
    .map((line, i) => {
      const lineNum = (startLine + i).toString().padStart(6, ' ');
      return `${lineNum}| ${line}`;
    })
    .join('\n');
}

/**
 * Get line ranges to display with context
 */
export function getLineRangesToDisplay(
  locations: Location[],
  totalLines: number,
  contextLines: number
): Set<number> {
  const linesToShow = new Set<number>();

  for (const loc of locations) {
    const startLine = loc.range.start.line;
    const endLine = loc.range.end.line;

    // Add context before
    for (let i = Math.max(0, startLine - contextLines); i <= startLine; i++) {
      linesToShow.add(i);
    }

    // Add the reference lines
    for (let i = startLine; i <= endLine; i++) {
      linesToShow.add(i);
    }

    // Add context after
    for (let i = endLine; i < Math.min(totalLines, endLine + contextLines + 1); i++) {
      linesToShow.add(i);
    }
  }

  return linesToShow;
}

/**
 * Line range type
 */
export interface LineRange {
  start: number;
  end: number;
}

/**
 * Convert a set of lines to ranges
 */
export function convertLinesToRanges(lines: Set<number>, _totalLines: number): LineRange[] {
  const sortedLines = Array.from(lines).sort((a, b) => a - b);
  const ranges: LineRange[] = [];

  let rangeStart = -1;
  let rangeEnd = -1;

  for (const line of sortedLines) {
    if (rangeStart === -1) {
      rangeStart = line;
      rangeEnd = line;
    } else if (line === rangeEnd + 1) {
      rangeEnd = line;
    } else {
      ranges.push({ start: rangeStart, end: rangeEnd });
      rangeStart = line;
      rangeEnd = line;
    }
  }

  if (rangeStart !== -1) {
    ranges.push({ start: rangeStart, end: rangeEnd });
  }

  return ranges;
}

/**
 * Format lines with ranges
 */
export function formatLinesWithRanges(lines: string[], ranges: LineRange[]): string {
  const output: string[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];

    // Add separator if not first range
    if (i > 0) {
      output.push('...');
    }

    // Add lines in range
    for (let lineNum = range.start; lineNum <= range.end && lineNum < lines.length; lineNum++) {
      const lineNumStr = (lineNum + 1).toString().padStart(6, ' ');
      output.push(`${lineNumStr}| ${lines[lineNum]}`);
    }
  }

  return output.join('\n');
}

/**
 * Get full definition by expanding the range
 */
export async function getFullDefinition(
  filePath: string,
  location: Location
): Promise<[string, Location]> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  const lines = content.split('\n');

  let startLine = location.range.start.line;
  let endLine = location.range.end.line;

  // Expand upward to include comments and decorators
  while (startLine > 0) {
    const prevLine = lines[startLine - 1].trim();
    if (prevLine.startsWith('//') || prevLine.startsWith('/*') || prevLine.startsWith('*') ||
        prevLine.startsWith('#') || prevLine.startsWith('@')) {
      startLine--;
    } else {
      break;
    }
  }

  // Expand downward to include full function/class body
  let braceCount = 0;
  let inString = false;
  let stringChar = '';

  for (let i = startLine; i <= endLine && i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      // Handle strings
      if ((char === '"' || char === "'") && (j === 0 || line[j - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
    }

    // If we've closed all braces, we can stop
    if (braceCount === 0 && i > location.range.start.line) {
      endLine = i;
      break;
    }
  }

  // Extract the definition text
  const definitionLines = lines.slice(startLine, endLine + 1);
  const definitionText = definitionLines.join('\n');

  // Create updated location
  const updatedLocation: Location = {
    ...location,
    range: {
      start: { line: startLine, character: 0 },
      end: { line: endLine, character: lines[endLine]?.length || 0 },
    },
  };

  return [definitionText, updatedLocation];
}

