/**
 * Tests for URI utilities
 */

import { pathToUri, uriToPath, uriDir, uriBasename, isFileUri } from './uri';
import * as path from 'path';

describe('URI utilities', () => {
  describe('pathToUri', () => {
    it('should convert file path to URI', () => {
      const filePath = path.join('/home', 'user', 'project', 'file.ts');
      const uri = pathToUri(filePath);
      expect(uri).toMatch(/^file:\/\//);
      expect(uri).toContain('file.ts');
    });

    it('should handle Windows paths', () => {
      if (process.platform === 'win32') {
        const filePath = 'C:\\Users\\test\\file.ts';
        const uri = pathToUri(filePath);
        expect(uri).toMatch(/^file:\/\/\//);
      }
    });
  });

  describe('uriToPath', () => {
    it('should convert URI to file path', () => {
      const uri = 'file:///home/user/project/file.ts';
      const filePath = uriToPath(uri);
      expect(filePath).toContain('file.ts');
    });

    it('should handle encoded URIs', () => {
      const uri = 'file:///home/user/my%20project/file.ts';
      const filePath = uriToPath(uri);
      expect(filePath).toContain('my project');
    });
  });

  describe('uriDir', () => {
    it('should get directory from URI', () => {
      const uri = 'file:///home/user/project/file.ts';
      const dir = uriDir(uri);
      expect(dir).toContain('project');
      expect(dir).not.toContain('file.ts');
    });
  });

  describe('uriBasename', () => {
    it('should get basename from URI', () => {
      const uri = 'file:///home/user/project/file.ts';
      const basename = uriBasename(uri);
      expect(basename).toBe('file.ts');
    });
  });

  describe('isFileUri', () => {
    it('should detect file URIs', () => {
      expect(isFileUri('file:///home/user/file.ts')).toBe(true);
      expect(isFileUri('http://example.com')).toBe(false);
      expect(isFileUri('/home/user/file.ts')).toBe(false);
    });
  });
});

