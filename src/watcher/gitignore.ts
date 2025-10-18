/**
 * Gitignore matcher for file watching
 */

import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';
import { createLogger, Component } from '../logging/logger.js';

const watcherLogger = createLogger(Component.WATCHER);

/**
 * Gitignore matcher
 */
export class GitignoreMatcher {
  private ig = ignore();

  constructor(workspacePath: string) {
    this.loadGitignore(workspacePath);
  }

  /**
   * Load .gitignore file
   */
  private loadGitignore(workspacePath: string): void {
    const gitignorePath = path.join(workspacePath, '.gitignore');

    try {
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        this.ig.add(content);
        watcherLogger.debug('Loaded .gitignore from %s', gitignorePath);
      }
    } catch (err) {
      watcherLogger.warn('Failed to load .gitignore: %s', err);
    }

    // Add some common patterns
    this.ig.add([
      '.git',
      'node_modules',
      '.DS_Store',
      '*.swp',
      '*.swo',
      '*~',
    ]);
  }

  /**
   * Check if a path should be ignored
   */
  shouldIgnore(filePath: string, _isDirectory: boolean): boolean {
    // Handle empty paths - don't ignore them
    if (!filePath || filePath.trim() === '') {
      return false;
    }

    const relativePath = filePath.replace(/\\/g, '/');
    
    // Handle root directory
    if (relativePath === '.' || relativePath === '/') {
      return false;
    }

    const result = this.ig.ignores(relativePath);
    return result;
  }
}

