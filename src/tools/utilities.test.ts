/**
 * Tests for tool utilities
 */

import {
  addLineNumbers,
  getLineRangesToDisplay,
  convertLinesToRanges,
  formatLinesWithRanges,
  LineRange,
} from './utilities';
import { Location, Range } from '../protocol/types';

describe('Tool utilities', () => {
  describe('addLineNumbers', () => {
    it('should add line numbers to text', () => {
      const text = 'line 1\nline 2\nline 3';
      const result = addLineNumbers(text, 10);

      expect(result).toContain('    10| line 1');
      expect(result).toContain('    11| line 2');
      expect(result).toContain('    12| line 3');
    });

    it('should pad line numbers correctly', () => {
      const text = 'line 1';
      const result = addLineNumbers(text, 1);

      expect(result).toMatch(/^\s+1\| line 1$/);
    });
  });

  describe('getLineRangesToDisplay', () => {
    it('should collect lines with context', () => {
      const locations: Location[] = [
        {
          uri: 'file:///test.ts',
          range: {
            start: { line: 10, character: 0 },
            end: { line: 10, character: 10 },
          } as Range,
        } as Location,
      ];

      const lines = getLineRangesToDisplay(locations, 100, 2);

      // Should include lines 8-12 (10 ± 2)
      expect(lines.has(8)).toBe(true);
      expect(lines.has(9)).toBe(true);
      expect(lines.has(10)).toBe(true);
      expect(lines.has(11)).toBe(true);
      expect(lines.has(12)).toBe(true);
      expect(lines.has(7)).toBe(false);
      expect(lines.has(13)).toBe(false);
    });

    it('should handle edge cases at start of file', () => {
      const locations: Location[] = [
        {
          uri: 'file:///test.ts',
          range: {
            start: { line: 1, character: 0 },
            end: { line: 1, character: 10 },
          } as Range,
        } as Location,
      ];

      const lines = getLineRangesToDisplay(locations, 100, 5);

      expect(lines.has(0)).toBe(true);
      expect(lines.has(1)).toBe(true);
      expect(lines.has(-1)).toBe(false);
    });
  });

  describe('convertLinesToRanges', () => {
    it('should convert consecutive lines to ranges', () => {
      const lines = new Set([1, 2, 3, 5, 6, 10]);
      const ranges = convertLinesToRanges(lines, 100);

      expect(ranges).toEqual([
        { start: 1, end: 3 },
        { start: 5, end: 6 },
        { start: 10, end: 10 },
      ]);
    });

    it('should handle single lines', () => {
      const lines = new Set([5]);
      const ranges = convertLinesToRanges(lines, 100);

      expect(ranges).toEqual([{ start: 5, end: 5 }]);
    });

    it('should handle empty set', () => {
      const lines = new Set<number>([]);
      const ranges = convertLinesToRanges(lines, 100);

      expect(ranges).toEqual([]);
    });
  });

  describe('formatLinesWithRanges', () => {
    it('should format lines with ranges', () => {
      const lines = ['line 0', 'line 1', 'line 2', 'line 3', 'line 4', 'line 5'];
      const ranges: LineRange[] = [
        { start: 0, end: 1 },
        { start: 3, end: 4 },
      ];

      const result = formatLinesWithRanges(lines, ranges);

      expect(result).toContain('     1| line 0');
      expect(result).toContain('     2| line 1');
      expect(result).toContain('...');
      expect(result).toContain('     4| line 3');
      expect(result).toContain('     5| line 4');
    });

    it('should handle single range', () => {
      const lines = ['line 0', 'line 1'];
      const ranges: LineRange[] = [{ start: 0, end: 1 }];

      const result = formatLinesWithRanges(lines, ranges);

      expect(result).not.toContain('...');
      expect(result).toContain('     1| line 0');
      expect(result).toContain('     2| line 1');
    });
  });
});

