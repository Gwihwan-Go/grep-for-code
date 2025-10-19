/**
 * Cache manager for LSP query results
 * Caches symbol queries, definitions, references, hover, etc.
 */

import { createLogger, Component } from '../logging/logger.js';
import { WorkspaceSymbol, Location, Hover, Diagnostic } from 'vscode-languageserver-protocol';

const cacheLogger = createLogger(Component.TOOLS);

export interface CacheConfig {
  enabled: boolean;
  maxSymbolCacheSize: number;
  maxLocationCacheSize: number;
  ttlSeconds?: number; // Optional TTL for cache entries
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface LocationCache {
  [positionKey: string]: CacheEntry<Location[]>;
}

interface HoverCache {
  [positionKey: string]: CacheEntry<Hover | null>;
}

/**
 * Cache manager for LSP query results
 */
export class LSPCacheManager {
  private config: CacheConfig;

  // Symbol-based caches (by query string)
  private workspaceSymbolsCache = new Map<string, CacheEntry<WorkspaceSymbol[]>>();
  
  // File-based caches (by file URI)
  private definitionsCache = new Map<string, LocationCache>();
  private referencesCache = new Map<string, LocationCache>();
  private hoverCache = new Map<string, HoverCache>();
  private diagnosticsCache = new Map<string, CacheEntry<Diagnostic[]>>();

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      maxSymbolCacheSize: config?.maxSymbolCacheSize ?? 1000,
      maxLocationCacheSize: config?.maxLocationCacheSize ?? 500,
      ttlSeconds: config?.ttlSeconds,
    };

    cacheLogger.info(
      'Cache manager initialized: enabled=%s, maxSymbolCacheSize=%d, maxLocationCacheSize=%d, ttl=%s',
      this.config.enabled,
      this.config.maxSymbolCacheSize,
      this.config.maxLocationCacheSize,
      this.config.ttlSeconds ? `${this.config.ttlSeconds}s` : 'none'
    );
  }

  /**
   * Generate a cache key for a symbol query
   */
  private symbolCacheKey(symbolName: string): string {
    return symbolName.toLowerCase();
  }

  /**
   * Generate a cache key for a position-based query
   */
  private positionCacheKey(line: number, character: number): string {
    return `${line}:${character}`;
  }

  /**
   * Check if a cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    if (!this.config.ttlSeconds) {
      return false;
    }
    const age = (Date.now() - entry.timestamp) / 1000;
    return age > this.config.ttlSeconds;
  }

  /**
   * Get workspace symbols from cache
   */
  getWorkspaceSymbols(symbolName: string): WorkspaceSymbol[] | null {
    if (!this.config.enabled) {
      return null;
    }

    const key = this.symbolCacheKey(symbolName);
    const entry = this.workspaceSymbolsCache.get(key);

    if (!entry) {
      cacheLogger.debug('Cache miss: workspace symbols for "%s"', symbolName);
      return null;
    }

    if (this.isExpired(entry)) {
      cacheLogger.debug('Cache expired: workspace symbols for "%s"', symbolName);
      this.workspaceSymbolsCache.delete(key);
      return null;
    }

    cacheLogger.debug('Cache hit: workspace symbols for "%s" (%d symbols)', symbolName, entry.data.length);
    return entry.data;
  }

  /**
   * Set workspace symbols in cache
   */
  setWorkspaceSymbols(symbolName: string, symbols: WorkspaceSymbol[]): void {
    if (!this.config.enabled) {
      return;
    }

    const key = this.symbolCacheKey(symbolName);

    // Enforce cache size limit
    if (this.workspaceSymbolsCache.size >= this.config.maxSymbolCacheSize) {
      // Remove oldest entry (simple FIFO)
      const firstKey = this.workspaceSymbolsCache.keys().next().value;
      if (firstKey) {
        this.workspaceSymbolsCache.delete(firstKey);
        cacheLogger.debug('Cache full: evicted oldest entry');
      }
    }

    this.workspaceSymbolsCache.set(key, {
      data: symbols,
      timestamp: Date.now(),
    });

    cacheLogger.debug('Cached workspace symbols for "%s" (%d symbols)', symbolName, symbols.length);
  }

  /**
   * Get definitions from cache
   */
  getDefinitions(filePath: string, line: number, character: number): Location[] | null {
    if (!this.config.enabled) {
      return null;
    }

    const uriCache = this.definitionsCache.get(filePath);
    if (!uriCache) {
      cacheLogger.debug('Cache miss: definitions for %s', filePath);
      return null;
    }

    const posKey = this.positionCacheKey(line, character);
    const entry = uriCache[posKey];

    if (!entry) {
      cacheLogger.debug('Cache miss: definitions at %s:%s', filePath, posKey);
      return null;
    }

    if (this.isExpired(entry)) {
      cacheLogger.debug('Cache expired: definitions at %s:%s', filePath, posKey);
      delete uriCache[posKey];
      return null;
    }

    cacheLogger.debug('Cache hit: definitions at %s:%s (%d locations)', filePath, posKey, entry.data.length);
    return entry.data;
  }

  /**
   * Set definitions in cache
   */
  setDefinitions(filePath: string, line: number, character: number, locations: Location[]): void {
    if (!this.config.enabled) {
      return;
    }

    let uriCache = this.definitionsCache.get(filePath);
    if (!uriCache) {
      uriCache = {};
      this.definitionsCache.set(filePath, uriCache);
    }

    const posKey = this.positionCacheKey(line, character);
    uriCache[posKey] = {
      data: locations,
      timestamp: Date.now(),
    };

    cacheLogger.debug('Cached definitions at %s:%s (%d locations)', filePath, posKey, locations.length);
  }

  /**
   * Get references from cache
   */
  getReferences(filePath: string, line: number, character: number): Location[] | null {
    if (!this.config.enabled) {
      return null;
    }

    const uriCache = this.referencesCache.get(filePath);
    if (!uriCache) {
      return null;
    }

    const posKey = this.positionCacheKey(line, character);
    const entry = uriCache[posKey];

    if (!entry || this.isExpired(entry)) {
      return null;
    }

    cacheLogger.debug('Cache hit: references at %s:%s (%d locations)', filePath, posKey, entry.data.length);
    return entry.data;
  }

  /**
   * Set references in cache
   */
  setReferences(filePath: string, line: number, character: number, locations: Location[]): void {
    if (!this.config.enabled) {
      return;
    }

    let uriCache = this.referencesCache.get(filePath);
    if (!uriCache) {
      uriCache = {};
      this.referencesCache.set(filePath, uriCache);
    }

    const posKey = this.positionCacheKey(line, character);
    uriCache[posKey] = {
      data: locations,
      timestamp: Date.now(),
    };

    cacheLogger.debug('Cached references at %s:%s (%d locations)', filePath, posKey, locations.length);
  }

  /**
   * Get hover info from cache
   */
  getHover(filePath: string, line: number, character: number): Hover | null | undefined {
    if (!this.config.enabled) {
      return undefined;
    }

    const uriCache = this.hoverCache.get(filePath);
    if (!uriCache) {
      return undefined;
    }

    const posKey = this.positionCacheKey(line, character);
    const entry = uriCache[posKey];

    if (!entry || this.isExpired(entry)) {
      return undefined;
    }

    cacheLogger.debug('Cache hit: hover at %s:%s', filePath, posKey);
    return entry.data;
  }

  /**
   * Set hover info in cache
   */
  setHover(filePath: string, line: number, character: number, hover: Hover | null): void {
    if (!this.config.enabled) {
      return;
    }

    let uriCache = this.hoverCache.get(filePath);
    if (!uriCache) {
      uriCache = {};
      this.hoverCache.set(filePath, uriCache);
    }

    const posKey = this.positionCacheKey(line, character);
    uriCache[posKey] = {
      data: hover,
      timestamp: Date.now(),
    };

    cacheLogger.debug('Cached hover at %s:%s', filePath, posKey);
  }

  /**
   * Get diagnostics from cache
   */
  getDiagnostics(filePath: string): Diagnostic[] | null {
    if (!this.config.enabled) {
      return null;
    }

    const entry = this.diagnosticsCache.get(filePath);

    if (!entry || this.isExpired(entry)) {
      return null;
    }

    cacheLogger.debug('Cache hit: diagnostics for %s (%d diagnostics)', filePath, entry.data.length);
    return entry.data;
  }

  /**
   * Set diagnostics in cache
   */
  setDiagnostics(filePath: string, diagnostics: Diagnostic[]): void {
    if (!this.config.enabled) {
      return;
    }

    this.diagnosticsCache.set(filePath, {
      data: diagnostics,
      timestamp: Date.now(),
    });

    cacheLogger.debug('Cached diagnostics for %s (%d diagnostics)', filePath, diagnostics.length);
  }

  /**
   * Invalidate cache for a specific file
   * Called when a file changes
   */
  invalidateFile(filePath: string): void {
    cacheLogger.debug('Invalidating cache for file: %s', filePath);

    // Clear file-specific caches
    this.definitionsCache.delete(filePath);
    this.referencesCache.delete(filePath);
    this.hoverCache.delete(filePath);
    this.diagnosticsCache.delete(filePath);

    // Note: workspace symbols might still be valid for other files,
    // so we don't clear them. They'll expire via TTL if configured.
  }

  /**
   * Invalidate all workspace symbol caches
   * Called when project structure changes significantly
   */
  invalidateWorkspaceSymbols(): void {
    cacheLogger.debug('Invalidating all workspace symbol caches');
    this.workspaceSymbolsCache.clear();
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    cacheLogger.info('Clearing all caches');
    this.workspaceSymbolsCache.clear();
    this.definitionsCache.clear();
    this.referencesCache.clear();
    this.hoverCache.clear();
    this.diagnosticsCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    workspaceSymbols: number;
    definitions: number;
    references: number;
    hover: number;
    diagnostics: number;
  } {
    return {
      workspaceSymbols: this.workspaceSymbolsCache.size,
      definitions: this.definitionsCache.size,
      references: this.referencesCache.size,
      hover: this.hoverCache.size,
      diagnostics: this.diagnosticsCache.size,
    };
  }

  /**
   * Log cache statistics
   */
  logStats(): void {
    const stats = this.getStats();
    cacheLogger.info(
      'Cache stats: symbols=%d, definitions=%d, references=%d, hover=%d, diagnostics=%d',
      stats.workspaceSymbols,
      stats.definitions,
      stats.references,
      stats.hover,
      stats.diagnostics
    );
  }
}


