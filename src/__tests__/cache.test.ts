/**
 * Cache tests
 * Tests for LSP caching functionality
 */

import { LSPCacheManager } from '../cache/manager';
import { Location, WorkspaceSymbol, Hover, Diagnostic, DiagnosticSeverity, Range } from '../protocol/types';

describe('LSPCacheManager', () => {
  let cacheManager: LSPCacheManager;

  beforeEach(() => {
    cacheManager = new LSPCacheManager({
      enabled: true,
      maxSymbolCacheSize: 100,
      maxLocationCacheSize: 50,
      ttlSeconds: undefined,
    });
  });

  describe('Workspace Symbols Cache', () => {
    it('should cache and retrieve workspace symbols', () => {
      const symbols: WorkspaceSymbol[] = [
        {
          name: 'TestFunction',
          kind: 12, // Function
          location: {
            uri: 'file:///test.ts',
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 10 },
            } as Range,
          } as Location,
        } as WorkspaceSymbol,
      ];

      // Cache miss
      expect(cacheManager.getWorkspaceSymbols('TestFunction')).toBeNull();

      // Set cache
      cacheManager.setWorkspaceSymbols('TestFunction', symbols);

      // Cache hit
      const cached = cacheManager.getWorkspaceSymbols('TestFunction');
      expect(cached).not.toBeNull();
      expect(cached).toHaveLength(1);
      expect(cached![0].name).toBe('TestFunction');
    });

    it('should handle case-insensitive queries', () => {
      const symbols: WorkspaceSymbol[] = [
        {
          name: 'TestFunction',
          kind: 12,
          location: {
            uri: 'file:///test.ts',
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 10 },
            } as Range,
          } as Location,
        } as WorkspaceSymbol,
      ];

      cacheManager.setWorkspaceSymbols('TestFunction', symbols);

      // Different case should still hit cache
      expect(cacheManager.getWorkspaceSymbols('testfunction')).not.toBeNull();
      expect(cacheManager.getWorkspaceSymbols('TESTFUNCTION')).not.toBeNull();
    });

    it('should enforce max cache size', () => {
      const smallCache = new LSPCacheManager({
        maxSymbolCacheSize: 2,
        maxLocationCacheSize: 50,
      });

      // Add 3 entries
      smallCache.setWorkspaceSymbols('Symbol1', []);
      smallCache.setWorkspaceSymbols('Symbol2', []);
      smallCache.setWorkspaceSymbols('Symbol3', []);

      // First entry should be evicted
      const stats = smallCache.getStats();
      expect(stats.workspaceSymbols).toBe(2);
    });
  });

  describe('Definitions Cache', () => {
    it('should cache and retrieve definitions', () => {
      const locations: Location[] = [
        {
          uri: 'file:///test.ts',
          range: {
            start: { line: 5, character: 10 },
            end: { line: 5, character: 20 },
          } as Range,
        } as Location,
      ];

      const filePath = '/test.ts';
      const line = 10;
      const character = 5;

      // Cache miss
      expect(cacheManager.getDefinitions(filePath, line, character)).toBeNull();

      // Set cache
      cacheManager.setDefinitions(filePath, line, character, locations);

      // Cache hit
      const cached = cacheManager.getDefinitions(filePath, line, character);
      expect(cached).not.toBeNull();
      expect(cached).toHaveLength(1);
      expect(cached![0].uri).toBe('file:///test.ts');
    });

    it('should invalidate on file change', () => {
      const locations: Location[] = [
        {
          uri: 'file:///test.ts',
          range: {
            start: { line: 5, character: 10 },
            end: { line: 5, character: 20 },
          } as Range,
        } as Location,
      ];

      const filePath = '/test.ts';
      cacheManager.setDefinitions(filePath, 10, 5, locations);

      // Verify cached
      expect(cacheManager.getDefinitions(filePath, 10, 5)).not.toBeNull();

      // Invalidate
      cacheManager.invalidateFile(filePath);

      // Should be null after invalidation
      expect(cacheManager.getDefinitions(filePath, 10, 5)).toBeNull();
    });
  });

  describe('References Cache', () => {
    it('should cache and retrieve references', () => {
      const locations: Location[] = [
        {
          uri: 'file:///test.ts',
          range: {
            start: { line: 15, character: 10 },
            end: { line: 15, character: 20 },
          } as Range,
        } as Location,
      ];

      const filePath = '/test.ts';
      const line = 10;
      const character = 5;

      // Cache miss
      expect(cacheManager.getReferences(filePath, line, character)).toBeNull();

      // Set cache
      cacheManager.setReferences(filePath, line, character, locations);

      // Cache hit
      const cached = cacheManager.getReferences(filePath, line, character);
      expect(cached).not.toBeNull();
      expect(cached).toHaveLength(1);
    });
  });

  describe('Hover Cache', () => {
    it('should cache and retrieve hover info', () => {
      const hover: Hover = {
        contents: {
          kind: 'markdown',
          value: 'Test hover content',
        },
        range: {
          start: { line: 10, character: 5 },
          end: { line: 10, character: 15 },
        } as Range,
      } as Hover;

      const filePath = '/test.ts';
      const line = 10;
      const character = 5;

      // Cache miss
      expect(cacheManager.getHover(filePath, line, character)).toBeUndefined();

      // Set cache
      cacheManager.setHover(filePath, line, character, hover);

      // Cache hit
      const cached = cacheManager.getHover(filePath, line, character);
      expect(cached).not.toBeUndefined();
      expect((cached as Hover).contents).toEqual({
        kind: 'markdown',
        value: 'Test hover content',
      });
    });

    it('should cache null hover results', () => {
      const filePath = '/test.ts';
      const line = 10;
      const character = 5;

      // Set cache with null
      cacheManager.setHover(filePath, line, character, null);

      // Should return null (not undefined)
      const cached = cacheManager.getHover(filePath, line, character);
      expect(cached).toBeNull();
    });
  });

  describe('Diagnostics Cache', () => {
    it('should cache and retrieve diagnostics', () => {
      const diagnostics: Diagnostic[] = [
        {
          range: {
            start: { line: 5, character: 0 },
            end: { line: 5, character: 10 },
          } as Range,
          message: 'Test error',
          severity: DiagnosticSeverity.Error,
        } as Diagnostic,
      ];

      const filePath = '/test.ts';

      // Cache miss
      expect(cacheManager.getDiagnostics(filePath)).toBeNull();

      // Set cache
      cacheManager.setDiagnostics(filePath, diagnostics);

      // Cache hit
      const cached = cacheManager.getDiagnostics(filePath);
      expect(cached).not.toBeNull();
      expect(cached).toHaveLength(1);
      expect(cached![0].message).toBe('Test error');
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      const ttlCache = new LSPCacheManager({
        enabled: true,
        maxSymbolCacheSize: 100,
        maxLocationCacheSize: 50,
        ttlSeconds: 1, // 1 second TTL
      });

      const symbols: WorkspaceSymbol[] = [
        {
          name: 'TestFunction',
          kind: 12,
          location: {
            uri: 'file:///test.ts',
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 10 },
            } as Range,
          } as Location,
        } as WorkspaceSymbol,
      ];

      // Set cache
      ttlCache.setWorkspaceSymbols('TestFunction', symbols);

      // Should be cached immediately
      expect(ttlCache.getWorkspaceSymbols('TestFunction')).not.toBeNull();

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      expect(ttlCache.getWorkspaceSymbols('TestFunction')).toBeNull();
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache statistics', () => {
      const filePath = '/test.ts';

      // Initially empty
      let stats = cacheManager.getStats();
      expect(stats.workspaceSymbols).toBe(0);
      expect(stats.definitions).toBe(0);
      expect(stats.references).toBe(0);
      expect(stats.hover).toBe(0);
      expect(stats.diagnostics).toBe(0);

      // Add entries
      cacheManager.setWorkspaceSymbols('Symbol1', []);
      cacheManager.setWorkspaceSymbols('Symbol2', []);
      cacheManager.setDefinitions(filePath, 10, 5, []);
      cacheManager.setReferences(filePath, 15, 8, []);
      cacheManager.setHover(filePath, 20, 10, null);
      cacheManager.setDiagnostics(filePath, []);

      // Check stats
      stats = cacheManager.getStats();
      expect(stats.workspaceSymbols).toBe(2);
      expect(stats.definitions).toBe(1);
      expect(stats.references).toBe(1);
      expect(stats.hover).toBe(1);
      expect(stats.diagnostics).toBe(1);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate all workspace symbols', () => {
      cacheManager.setWorkspaceSymbols('Symbol1', []);
      cacheManager.setWorkspaceSymbols('Symbol2', []);

      expect(cacheManager.getStats().workspaceSymbols).toBe(2);

      cacheManager.invalidateWorkspaceSymbols();

      expect(cacheManager.getStats().workspaceSymbols).toBe(0);
    });

    it('should clear all caches', () => {
      const filePath = '/test.ts';

      // Populate all caches
      cacheManager.setWorkspaceSymbols('Symbol1', []);
      cacheManager.setDefinitions(filePath, 10, 5, []);
      cacheManager.setReferences(filePath, 15, 8, []);
      cacheManager.setHover(filePath, 20, 10, null);
      cacheManager.setDiagnostics(filePath, []);

      // Verify all populated
      const statsBefore = cacheManager.getStats();
      expect(statsBefore.workspaceSymbols).toBeGreaterThan(0);
      expect(statsBefore.definitions).toBeGreaterThan(0);

      // Clear all
      cacheManager.clearAll();

      // Verify all empty
      const statsAfter = cacheManager.getStats();
      expect(statsAfter.workspaceSymbols).toBe(0);
      expect(statsAfter.definitions).toBe(0);
      expect(statsAfter.references).toBe(0);
      expect(statsAfter.hover).toBe(0);
      expect(statsAfter.diagnostics).toBe(0);
    });
  });

  describe('Cache Disabled', () => {
    it('should not cache when disabled', () => {
      const disabledCache = new LSPCacheManager({
        enabled: false,
      });

      const symbols: WorkspaceSymbol[] = [
        {
          name: 'TestFunction',
          kind: 12,
          location: {
            uri: 'file:///test.ts',
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 10 },
            } as Range,
          } as Location,
        } as WorkspaceSymbol,
      ];

      // Try to cache
      disabledCache.setWorkspaceSymbols('TestFunction', symbols);

      // Should not be cached
      expect(disabledCache.getWorkspaceSymbols('TestFunction')).toBeNull();
    });
  });
});

