/**
 * Tests for LSP transport layer
 */

import {
  createRequest,
  createNotification,
  createResponse,
  createErrorResponse,
} from './transport';

describe('LSP Transport', () => {
  describe('Message creation', () => {
    it('should create request message', () => {
      const msg = createRequest(1, 'initialize', { processId: 123 });

      expect(msg.jsonrpc).toBe('2.0');
      expect(msg.id).toBe(1);
      expect(msg.method).toBe('initialize');
      expect(msg.params).toEqual({ processId: 123 });
    });

    it('should create notification message', () => {
      const msg = createNotification('initialized', {});

      expect(msg.jsonrpc).toBe('2.0');
      expect(msg.id).toBeUndefined();
      expect(msg.method).toBe('initialized');
      expect(msg.params).toEqual({});
    });

    it('should create response message', () => {
      const msg = createResponse(1, { capabilities: {} });

      expect(msg.jsonrpc).toBe('2.0');
      expect(msg.id).toBe(1);
      expect(msg.result).toEqual({ capabilities: {} });
    });

    it('should create error response message', () => {
      const msg = createErrorResponse(1, {
        code: -32600,
        message: 'Invalid Request',
      });

      expect(msg.jsonrpc).toBe('2.0');
      expect(msg.id).toBe(1);
      expect(msg.error).toEqual({
        code: -32600,
        message: 'Invalid Request',
      });
    });
  });

  describe('Message structure', () => {
    it('should have correct jsonrpc version', () => {
      const msg = createRequest(1, 'test', {});
      expect(msg.jsonrpc).toBe('2.0');
    });

    it('should allow string or number IDs', () => {
      const msgNum = createRequest(1, 'test', {});
      const msgStr = createRequest('abc', 'test', {});

      expect(msgNum.id).toBe(1);
      expect(msgStr.id).toBe('abc');
    });
  });
});

