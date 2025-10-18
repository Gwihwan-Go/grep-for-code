/**
 * Tests for logging module
 */

import { Writable } from 'stream';
import {
  createLogger,
  Component,
  LogLevel,
  setLevel,
  setGlobalLevel,
  setupTestLogging,
  resetTestLogging,
} from './logger';

describe('Logger', () => {
  let capturedOutput: string[] = [];
  let testStream: Writable;

  beforeEach(() => {
    capturedOutput = [];
    testStream = new Writable({
      write(chunk, _encoding, callback) {
        capturedOutput.push(chunk.toString());
        callback();
      },
    });
    setupTestLogging(testStream);
  });

  afterEach(() => {
    resetTestLogging();
  });

  describe('Component-based logging', () => {
    it('should log messages for different components', () => {
      const coreLogger = createLogger(Component.CORE);
      const lspLogger = createLogger(Component.LSP);

      coreLogger.info('Core message');
      lspLogger.info('LSP message');

      expect(capturedOutput.length).toBe(2);
      expect(capturedOutput[0]).toContain('[INFO][core] Core message');
      expect(capturedOutput[1]).toContain('[INFO][lsp] LSP message');
    });
  });

  describe('Log levels', () => {
    it('should respect log levels', () => {
      setGlobalLevel(LogLevel.ERROR);
      const logger = createLogger(Component.CORE);

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(capturedOutput.length).toBe(1);
      expect(capturedOutput[0]).toContain('[ERROR][core] Error message');
    });

    it('should allow per-component log levels', () => {
      setLevel(Component.CORE, LogLevel.DEBUG);
      setLevel(Component.LSP, LogLevel.ERROR);

      const coreLogger = createLogger(Component.CORE);
      const lspLogger = createLogger(Component.LSP);

      coreLogger.debug('Core debug');
      lspLogger.debug('LSP debug');
      lspLogger.error('LSP error');

      expect(capturedOutput.length).toBe(2);
      expect(capturedOutput[0]).toContain('[DEBUG][core] Core debug');
      expect(capturedOutput[1]).toContain('[ERROR][lsp] LSP error');
    });
  });

  describe('Message formatting', () => {
    it('should format messages with placeholders', () => {
      const logger = createLogger(Component.CORE);

      logger.info('String: %s, Number: %d, JSON: %j', 'test', 42, { key: 'value' });

      expect(capturedOutput[0]).toContain('String: test, Number: 42, JSON: {"key":"value"}');
    });

    it('should handle missing arguments', () => {
      const logger = createLogger(Component.CORE);

      logger.info('Value: %s', undefined);

      expect(capturedOutput[0]).toContain('Value: undefined');
    });
  });

  describe('isLevelEnabled', () => {
    it('should correctly report enabled levels', () => {
      setGlobalLevel(LogLevel.WARN);
      const logger = createLogger(Component.CORE);

      expect(logger.isLevelEnabled(LogLevel.DEBUG)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.INFO)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.WARN)).toBe(true);
      expect(logger.isLevelEnabled(LogLevel.ERROR)).toBe(true);
      expect(logger.isLevelEnabled(LogLevel.FATAL)).toBe(true);
    });
  });
});

