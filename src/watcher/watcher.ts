/**
 * Workspace file watcher
 * Monitors file system changes and notifies the LSP server
 */

import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { createLogger, Component } from '../logging/logger.js';
import { GitignoreMatcher } from './gitignore.js';
import { LSPClient, registerFileWatchHandler } from '../lsp/client.js';
import { pathToUri } from '../protocol/uri.js';
import { FileChangeType, WatchKind, DidChangeWatchedFilesParams, FileEvent } from '../protocol/types.js';

const watcherLogger = createLogger(Component.WATCHER);

/**
 * Watcher configuration
 */
export interface WatcherConfig {
  debounceTime: number;
  excludedDirs: Set<string>;
  excludedFileExtensions: Set<string>;
  largeBinaryExtensions: Set<string>;
  maxFileSize: number;
}

/**
 * Default watcher configuration
 */
export function defaultWatcherConfig(): WatcherConfig {
  return {
    debounceTime: 100,
    excludedDirs: new Set([
      'node_modules',
      '.git',
      'dist',
      'build',
      'out',
      'target',
      '.idea',
      '.vscode',
      '__pycache__',
      '.pytest_cache',
      '.mypy_cache',
      'vendor',
    ]),
    excludedFileExtensions: new Set([
      '.pyc',
      '.pyo',
      '.class',
      '.o',
      '.obj',
      '.exe',
      '.dll',
      '.so',
      '.dylib',
    ]),
    largeBinaryExtensions: new Set([
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.bmp',
      '.ico',
      '.pdf',
      '.zip',
      '.tar',
      '.gz',
      '.7z',
      '.rar',
      '.mp3',
      '.mp4',
      '.avi',
      '.mov',
    ]),
    maxFileSize: 10 * 1024 * 1024, // 10MB
  };
}

/**
 * File system watcher pattern
 */
interface WatcherPattern {
  globPattern: any;
  kind?: WatchKind;
}

/**
 * Workspace watcher
 */
export class WorkspaceWatcher {
  private workspacePath = '';
  private config: WatcherConfig;
  private gitignore?: GitignoreMatcher;
  private registrations: WatcherPattern[] = [];
  private watcher?: chokidar.FSWatcher;
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private client: LSPClient,
    config?: Partial<WatcherConfig>
  ) {
    this.config = { ...defaultWatcherConfig(), ...config };
  }

  /**
   * Add file watcher registrations
   */
  addRegistrations(id: string, watchers: any[]): void {
    watcherLogger.info('Added %d file watcher registrations (id: %s), total: %d', 
      watchers.length, id, this.registrations.length + watchers.length);

    for (const watcher of watchers) {
      this.registrations.push({
        globPattern: watcher.globPattern,
        kind: watcher.kind,
      });
    }

    // Open matching files
    this.openMatchingFiles();
  }

  /**
   * Start watching workspace
   */
  async watchWorkspace(workspacePath: string): Promise<void> {
    this.workspacePath = workspacePath;

    // Initialize gitignore matcher
    try {
      this.gitignore = new GitignoreMatcher(workspacePath);
      watcherLogger.info('Initialized gitignore matcher for %s', workspacePath);
    } catch (err) {
      watcherLogger.error('Error initializing gitignore matcher: %s', err);
    }

    // Register handler for file watcher registrations from the server
    registerFileWatchHandler((id: string, watchers: any[]) => {
      this.addRegistrations(id, watchers);
    });

    // Create file watcher
    this.watcher = chokidar.watch(workspacePath, {
      ignored: (filePath: string) => this.shouldExcludePath(filePath),
      persistent: true,
      ignoreInitial: false,
      followSymlinks: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    // Handle file events
    this.watcher
      .on('add', (filePath: string) => this.handleFileEvent(filePath, FileChangeType.Created))
      .on('change', (filePath: string) => this.handleFileEvent(filePath, FileChangeType.Changed))
      .on('unlink', (filePath: string) => this.handleFileEvent(filePath, FileChangeType.Deleted))
      .on('error', (err: Error) => watcherLogger.error('Watcher error: %s', err));

    watcherLogger.info('Started watching workspace: %s', workspacePath);
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
  }

  /**
   * Check if a path should be excluded
   */
  private shouldExcludePath(filePath: string): boolean {
    const relativePath = path.relative(this.workspacePath, filePath);
    const parts = relativePath.split(path.sep);

    // Check if any directory in the path is excluded
    for (const part of parts) {
      if (this.config.excludedDirs.has(part)) {
        return true;
      }
      if (part.startsWith('.')) {
        return true;
      }
    }

    // Check file extensions
    const ext = path.extname(filePath).toLowerCase();
    if (this.config.excludedFileExtensions.has(ext) || this.config.largeBinaryExtensions.has(ext)) {
      return true;
    }

    // Check gitignore
    if (this.gitignore) {
      const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
      if (stats && this.gitignore.shouldIgnore(relativePath, stats.isDirectory())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if file should be excluded
   */
  private shouldExcludeFile(filePath: string): boolean {
    const fileName = path.basename(filePath);

    // Skip dot files
    if (fileName.startsWith('.')) {
      return true;
    }

    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    if (this.config.excludedFileExtensions.has(ext) || this.config.largeBinaryExtensions.has(ext)) {
      return true;
    }

    // Check file size
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > this.config.maxFileSize) {
        watcherLogger.debug('Skipping large file: %s (%.2f MB)', filePath, stats.size / (1024 * 1024));
        return true;
      }
    } catch (err) {
      return true;
    }

    // Check gitignore
    if (this.gitignore) {
      const relativePath = path.relative(this.workspacePath, filePath);
      if (this.gitignore.shouldIgnore(relativePath, false)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Handle file events
   */
  private handleFileEvent(filePath: string, changeType: FileChangeType): void {
    if (this.shouldExcludeFile(filePath)) {
      return;
    }

    const [watched, kind] = this.isPathWatched(filePath);
    if (!watched) {
      return;
    }

    // Check if this event type is watched
    if (changeType === FileChangeType.Created && !(kind & WatchKind.Create)) {
      return;
    }
    if (changeType === FileChangeType.Changed && !(kind & WatchKind.Change)) {
      return;
    }
    if (changeType === FileChangeType.Deleted && !(kind & WatchKind.Delete)) {
      return;
    }

    // Handle file creation - open the file
    if (changeType === FileChangeType.Created) {
      this.client.openFile(filePath).catch((err) => {
        watcherLogger.debug('Error opening file %s: %s', filePath, err);
      });
    }

    // Handle change - notify if file is open, otherwise send didChangeWatchedFiles
    if (changeType === FileChangeType.Changed && this.client.isFileOpen(filePath)) {
      this.debounceNotifyChange(filePath);
      return;
    }

    // Send didChangeWatchedFiles notification
    this.debounceFileEvent(filePath, changeType);
  }

  /**
   * Debounce file events
   */
  private debounceFileEvent(filePath: string, changeType: FileChangeType): void {
    const key = `${filePath}:${changeType}`;

    // Cancel existing timer
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    // Create new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      this.notifyFileEvent(filePath, changeType);
    }, this.config.debounceTime);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Debounce change notifications
   */
  private debounceNotifyChange(filePath: string): void {
    const key = `change:${filePath}`;

    // Cancel existing timer
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    // Create new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      this.client.notifyChange(filePath).catch((err) => {
        watcherLogger.error('Error notifying change: %s', err);
      });
    }, this.config.debounceTime);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Notify LSP server of file event
   */
  private notifyFileEvent(filePath: string, changeType: FileChangeType): void {
    watcherLogger.debug('Notifying file event: %s (type: %d)', filePath, changeType);

    const params: DidChangeWatchedFilesParams = {
      changes: [
        {
          uri: pathToUri(filePath),
          type: changeType,
        } as FileEvent,
      ],
    };

    this.client.didChangeWatchedFiles(params).catch((err) => {
      watcherLogger.error('Error notifying LSP server about file event: %s', err);
    });
  }

  /**
   * Check if a path is watched
   */
  private isPathWatched(filePath: string): [boolean, WatchKind] {
    // If no explicit registrations, watch everything
    if (this.registrations.length === 0) {
      return [true, WatchKind.Create | WatchKind.Change | WatchKind.Delete];
    }

    // Check each registration
    for (const reg of this.registrations) {
      if (this.matchesPattern(filePath, reg.globPattern)) {
        const kind = reg.kind ?? (WatchKind.Create | WatchKind.Change | WatchKind.Delete);
        return [true, kind];
      }
    }

    return [false, 0 as WatchKind];
  }

  /**
   * Match a path against a glob pattern
   */
  private matchesPattern(filePath: string, pattern: any): boolean {
    // Simple glob matching - check for common patterns
    if (typeof pattern === 'string') {
      return this.matchGlob(filePath, pattern);
    }

    // Handle RelativePattern
    if (pattern && typeof pattern === 'object' && 'pattern' in pattern) {
      return this.matchGlob(filePath, pattern.pattern);
    }

    return false;
  }

  /**
   * Simple glob matching
   */
  private matchGlob(filePath: string, pattern: string): boolean {
    const relativePath = path.relative(this.workspacePath, filePath);
    const normalizedPath = relativePath.replace(/\\/g, '/');

    // Handle **/* pattern
    if (pattern === '**/*') {
      return true;
    }

    // Handle **/*.ext pattern
    if (pattern.startsWith('**/')) {
      const rest = pattern.substring(3);
      if (rest.startsWith('*.')) {
        const ext = rest.substring(1);
        return normalizedPath.endsWith(ext);
      }
    }

    // Handle *.ext pattern
    if (pattern.startsWith('*.')) {
      const ext = pattern.substring(1);
      return normalizedPath.endsWith(ext);
    }

    return false;
  }

  /**
   * Open files that match registered patterns
   */
  private async openMatchingFiles(): Promise<void> {
    const startTime = Date.now();
    let filesOpened = 0;

    const walkDir = async (dir: string): Promise<void> => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!this.shouldExcludePath(fullPath)) {
            await walkDir(fullPath);
          }
        } else {
          if (!this.shouldExcludeFile(fullPath)) {
            const [watched] = this.isPathWatched(fullPath);
            if (watched) {
              try {
                await this.client.openFile(fullPath);
                filesOpened++;

                // Add delay every 100 files
                if (filesOpened % 100 === 0) {
                  await new Promise((resolve) => setTimeout(resolve, 10));
                }
              } catch (err) {
                watcherLogger.debug('Error opening file %s: %s', fullPath, err);
              }
            }
          }
        }
      }
    };

    try {
      await walkDir(this.workspacePath);
      const elapsed = (Date.now() - startTime) / 1000;
      watcherLogger.info('Workspace scan complete: processed %d files in %.2f seconds', filesOpened, elapsed);
    } catch (err) {
      watcherLogger.error('Error scanning workspace for files to open: %s', err);
    }
  }
}

