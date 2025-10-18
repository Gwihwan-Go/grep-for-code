/**
 * URI utilities for working with file URIs
 */

import { URI } from 'vscode-uri';
import * as path from 'path';

/**
 * Convert a file path to a file:// URI
 */
export function pathToUri(filePath: string): string {
  return URI.file(filePath).toString();
}

/**
 * Convert a file:// URI to a file path
 */
export function uriToPath(uri: string): string {
  return URI.parse(uri).fsPath;
}

/**
 * Get the directory path from a URI
 */
export function uriDir(uri: string): string {
  return path.dirname(uriToPath(uri));
}

/**
 * Get the base name from a URI
 */
export function uriBasename(uri: string): string {
  return path.basename(uriToPath(uri));
}

/**
 * Check if a URI is a file URI
 */
export function isFileUri(uri: string): boolean {
  return uri.startsWith('file://');
}

