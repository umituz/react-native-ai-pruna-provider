/**
 * Pruna Logger
 * Centralized logging with automatic session management
 * Eliminates repetitive logging code throughout the codebase
 */

import { SessionId } from "../../domain/value-objects/session-id.value";

export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  readonly sessionId: string;
  readonly tag: string;
}

export class PrunaLogger {
  private static instance: PrunaLogger;
  private sessions = new Map<string, number>();

  private constructor() {}

  static getInstance(): PrunaLogger {
    if (!PrunaLogger.instance) {
      PrunaLogger.instance = new PrunaLogger();
    }
    return PrunaLogger.instance;
  }

  createSession(): string {
    const sessionId = new SessionId();
    const id = sessionId.toString();
    this.sessions.set(id, Date.now());
    return id;
  }

  endSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private log(
    sessionId: string,
    level: LogLevel,
    tag: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    const elapsed = this.calculateElapsed(sessionId);
    const entry = {
      timestamp: Date.now(),
      elapsed,
      level,
      tag,
      message,
      ...(data && { data }),
    };

    // Console output in DEV mode
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const consoleFn = level === LogLevel.ERROR ? console.error :
                       level === LogLevel.WARN ? console.warn : console.log;
      consoleFn(`[${tag}] ${message}`, data ?? '');
    }
  }

  info(sessionId: string, tag: string, message: string, data?: Record<string, unknown>): void {
    this.log(sessionId, LogLevel.INFO, tag, message, data);
  }

  warn(sessionId: string, tag: string, message: string, data?: Record<string, unknown>): void {
    this.log(sessionId, LogLevel.WARN, tag, message, data);
  }

  error(sessionId: string, tag: string, message: string, data?: Record<string, unknown>): void {
    this.log(sessionId, LogLevel.ERROR, tag, message, data);
  }

  private calculateElapsed(sessionId: string): number {
    const startTime = this.sessions.get(sessionId);
    return startTime ? Date.now() - startTime : 0;
  }
}

// Singleton instance
export const logger = PrunaLogger.getInstance();

// Convenience factory function
export function createLogger(tag: string) {
  return {
    info: (sessionId: string, message: string, data?: Record<string, unknown>) =>
      logger.info(sessionId, tag, message, data),
    warn: (sessionId: string, message: string, data?: Record<string, unknown>) =>
      logger.warn(sessionId, tag, message, data),
    error: (sessionId: string, message: string, data?: Record<string, unknown>) =>
      logger.error(sessionId, tag, message, data),
  };
}
