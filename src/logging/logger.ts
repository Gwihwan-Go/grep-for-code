/**
 * Logging module for MCP Language Server
 * Provides component-based logging with configurable log levels
 */

import * as fs from 'fs';

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * Component types for filtering logs
 */
export enum Component {
  CORE = 'core',
  LSP = 'lsp',
  WIRE = 'wire',
  LSP_PROCESS = 'lsp-process',
  WATCHER = 'watcher',
  TOOLS = 'tools',
}

/**
 * Logger interface
 */
export interface Logger {
  debug(format: string, ...args: any[]): void;
  info(format: string, ...args: any[]): void;
  warn(format: string, ...args: any[]): void;
  error(format: string, ...args: any[]): void;
  fatal(format: string, ...args: any[]): void;
  isLevelEnabled(level: LogLevel): boolean;
}

/**
 * Global configuration
 */
class LoggingConfig {
  defaultMinLevel: LogLevel = LogLevel.INFO;
  componentLevels: Map<Component, LogLevel> = new Map();
  writer: NodeJS.WritableStream = process.stderr;
  testOutput?: NodeJS.WritableStream;

  constructor() {
    // Initialize component levels
    Object.values(Component).forEach((comp) => {
      this.componentLevels.set(comp, this.defaultMinLevel);
    });

    // Parse log level from environment
    const logLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (logLevel) {
      const level = this.parseLogLevel(logLevel);
      if (level !== undefined) {
        this.defaultMinLevel = level;
        // Update all components
        Object.values(Component).forEach((comp) => {
          this.componentLevels.set(comp, level);
        });
      }
    }

    // Allow overriding levels for specific components
    const compLevels = process.env.LOG_COMPONENT_LEVELS;
    if (compLevels) {
      compLevels.split(',').forEach((part) => {
        const [compStr, levelStr] = part.split(':').map((s) => s.trim());
        if (!compStr || !levelStr) return;

        const comp = compStr as Component;
        const level = this.parseLogLevel(levelStr.toUpperCase());
        if (level !== undefined) {
          this.componentLevels.set(comp, level);
        }
      });
    }

    // Use custom log file if specified
    const logFile = process.env.LOG_FILE;
    if (logFile) {
      try {
        const fileStream = fs.createWriteStream(logFile, { flags: 'a' });
        this.writer = fileStream;
      } catch (err) {
        console.error(`Failed to open log file ${logFile}:`, err);
      }
    }
  }

  private parseLogLevel(levelStr: string): LogLevel | undefined {
    switch (levelStr) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      case 'FATAL':
        return LogLevel.FATAL;
      default:
        return undefined;
    }
  }
}

const config = new LoggingConfig();

/**
 * Format a log message
 */
function formatMessage(format: string, ...args: any[]): string {
  let i = 0;
  return format.replace(/%[sdifj%]/g, (match) => {
    if (match === '%%') return '%';
    if (i >= args.length) return match;
    
    const arg = args[i++];
    switch (match) {
      case '%s':
        return String(arg);
      case '%d':
      case '%i':
        return String(parseInt(arg, 10));
      case '%f':
        return String(parseFloat(arg));
      case '%j':
        return JSON.stringify(arg);
      default:
        return match;
    }
  });
}

/**
 * Get log level name
 */
function getLevelName(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return 'DEBUG';
    case LogLevel.INFO:
      return 'INFO';
    case LogLevel.WARN:
      return 'WARN';
    case LogLevel.ERROR:
      return 'ERROR';
    case LogLevel.FATAL:
      return 'FATAL';
    default:
      return `LEVEL(${level})`;
  }
}

/**
 * Component-specific logger implementation
 */
class ComponentLogger implements Logger {
  constructor(private component: Component) {}

  isLevelEnabled(level: LogLevel): boolean {
    const minLevel = config.componentLevels.get(this.component) ?? config.defaultMinLevel;
    return level >= minLevel;
  }

  private log(level: LogLevel, format: string, ...args: any[]): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const message = formatMessage(format, ...args);
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} [${getLevelName(level)}][${this.component}] ${message}\n`;

    try {
      config.writer.write(logMessage);
      
      // Write to test output if set
      if (config.testOutput) {
        config.testOutput.write(logMessage);
      }
    } catch (err) {
      console.error('Failed to output log:', err);
    }
  }

  debug(format: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, format, ...args);
  }

  info(format: string, ...args: any[]): void {
    this.log(LogLevel.INFO, format, ...args);
  }

  warn(format: string, ...args: any[]): void {
    this.log(LogLevel.WARN, format, ...args);
  }

  error(format: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, format, ...args);
  }

  fatal(format: string, ...args: any[]): void {
    this.log(LogLevel.FATAL, format, ...args);
    process.exit(1);
  }
}

/**
 * Create a new logger for the specified component
 */
export function createLogger(component: Component): Logger {
  return new ComponentLogger(component);
}

/**
 * Set the minimum log level for a component
 */
export function setLevel(component: Component, level: LogLevel): void {
  config.componentLevels.set(component, level);
}

/**
 * Set the log level for all components
 */
export function setGlobalLevel(level: LogLevel): void {
  config.defaultMinLevel = level;
  Object.values(Component).forEach((comp) => {
    config.componentLevels.set(comp, level);
  });
}

/**
 * Set the writer for log output
 */
export function setWriter(writer: NodeJS.WritableStream): void {
  config.writer = writer;
}

/**
 * Setup file logging
 */
export function setupFileLogging(filePath: string): void {
  try {
    const fileStream = fs.createWriteStream(filePath, { flags: 'a' });
    config.writer = fileStream;
  } catch (err) {
    throw new Error(`Failed to open log file: ${err}`);
  }
}

/**
 * Setup test logging
 */
export function setupTestLogging(captureOutput: NodeJS.WritableStream): void {
  config.testOutput = captureOutput;
}

/**
 * Reset test logging
 */
export function resetTestLogging(): void {
  config.testOutput = undefined;
}

