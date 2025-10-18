/**
 * LSP Transport layer - handles JSON-RPC message reading and writing
 */

import { Readable, Writable } from 'stream';
import { createLogger, Component } from '../logging/logger.js';

const lspLogger = createLogger(Component.LSP);
const wireLogger = createLogger(Component.WIRE);

/**
 * Request ID type - can be string or number
 */
export type RequestId = string | number;

/**
 * LSP Message structure
 */
export interface LSPMessage {
  jsonrpc: '2.0';
  id?: RequestId;
  method?: string;
  params?: any;
  result?: any;
  error?: ResponseError;
}

/**
 * Response error structure
 */
export interface ResponseError {
  code: number;
  message: string;
  data?: any;
}

/**
 * Create a request message
 */
export function createRequest(id: RequestId, method: string, params?: any): LSPMessage {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };
}

/**
 * Create a notification message (no ID)
 */
export function createNotification(method: string, params?: any): LSPMessage {
  return {
    jsonrpc: '2.0',
    method,
    params,
  };
}

/**
 * Create a response message
 */
export function createResponse(id: RequestId, result: any): LSPMessage {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Create an error response message
 */
export function createErrorResponse(id: RequestId, error: ResponseError): LSPMessage {
  return {
    jsonrpc: '2.0',
    id,
    error,
  };
}

/**
 * Write an LSP message to a stream
 */
export function writeMessage(stream: Writable, message: LSPMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const content = JSON.stringify(message);
      const contentLength = Buffer.byteLength(content, 'utf8');
      
      // Log the message
      lspLogger.debug('Sending message: method=%s id=%s', message.method, message.id);
      wireLogger.debug('-> Sending: %s', content);

      const header = `Content-Length: ${contentLength}\r\n\r\n`;
      const fullMessage = header + content;

      stream.write(fullMessage, 'utf8', (err) => {
        if (err) {
          reject(new Error(`Failed to write message: ${err.message}`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(new Error(`Failed to marshal message: ${err}`));
    }
  });
}

/**
 * Message reader for reading LSP messages from a stream
 */
export class MessageReader {
  private buffer = Buffer.alloc(0);
  private contentLength = -1;

  constructor(private stream: Readable) {}

  /**
   * Read the next message from the stream
   */
  async readMessage(): Promise<LSPMessage> {
    return new Promise((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.tryParse(resolve, reject, onData, onEnd, onError);
      };

      const onEnd = () => {
        reject(new Error('LSP connection closed (EOF)'));
      };

      const onError = (err: Error) => {
        reject(new Error(`Error reading LSP stream: ${err.message}`));
      };

      this.stream.on('data', onData);
      this.stream.once('end', onEnd);
      this.stream.once('error', onError);

      // Try to parse if we already have data
      this.tryParse(resolve, reject, onData, onEnd, onError);
    });
  }

  /**
   * Try to parse a complete message from the buffer
   */
  private tryParse(
    resolve: (msg: LSPMessage) => void,
    reject: (err: Error) => void,
    onData: (chunk: Buffer) => void,
    onEnd: () => void,
    onError: (err: Error) => void
  ): void {
    try {
      // If we don't have content length yet, try to parse headers
      if (this.contentLength < 0) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd < 0) {
          return; // Need more data for headers
        }

        const headers = this.buffer.slice(0, headerEnd).toString('utf8');
        const lines = headers.split('\r\n');

        for (const line of lines) {
          wireLogger.debug('<- Header: %s', line);
          if (line.startsWith('Content-Length: ')) {
            this.contentLength = parseInt(line.substring(16), 10);
          }
        }

        if (this.contentLength < 0) {
          reject(new Error('Missing Content-Length header'));
          return;
        }

        // Remove headers from buffer
        this.buffer = this.buffer.slice(headerEnd + 4);
      }

      // Check if we have the complete content
      if (this.buffer.length < this.contentLength) {
        return; // Need more data for content
      }

      // Extract the message content
      const content = this.buffer.slice(0, this.contentLength).toString('utf8');
      this.buffer = this.buffer.slice(this.contentLength);
      this.contentLength = -1;

      wireLogger.debug('<- Received: %s', content);

      // Parse JSON
      const message = JSON.parse(content) as LSPMessage;

      // Log higher-level information
      if (message.method && message.id !== undefined) {
        lspLogger.debug('Received request from server: method=%s id=%s', message.method, message.id);
      } else if (message.method) {
        lspLogger.debug('Received notification: method=%s', message.method);
      } else if (message.id !== undefined) {
        lspLogger.debug('Received response for ID: %s', message.id);
      }

      // Cleanup listeners
      this.stream.off('data', onData);
      this.stream.off('end', onEnd);
      this.stream.off('error', onError);

      resolve(message);
    } catch (err) {
      reject(new Error(`Failed to parse LSP message: ${err}`));
    }
  }
}

