/**
 * Generation Log Collector
 * Session-scoped log collection — each generation gets its own isolated session.
 * Supports concurrent generations without data corruption.
 *
 * Usage:
 *   const sessionId = collector.startSession();
 *   collector.log(sessionId, 'tag', 'message');
 *   const entries = collector.endSession(sessionId);
 */

export interface LogEntry {
  readonly timestamp: number;
  readonly elapsed: number;
  readonly level: 'info' | 'warn' | 'error';
  readonly tag: string;
  readonly message: string;
  readonly data?: Record<string, unknown>;
}

interface Session {
  readonly startTime: number;
  entries: LogEntry[];
}

let sessionCounter = 0;

/** Max concurrent sessions before auto-evicting oldest */
const MAX_SESSIONS = 50;

class GenerationLogCollector {
  private sessions = new Map<string, Session>();
  private sessionQueue = new Set<string>(); // O(1) lookup and deletion

  startSession(): string {
    // Evict oldest session if limit exceeded
    if (this.sessionQueue.size >= MAX_SESSIONS) {
      const oldestKey = this.sessionQueue.keys().next().value;
      if (oldestKey) {
        this.sessions.delete(oldestKey);
        this.sessionQueue.delete(oldestKey);
      }
    }

    const id = `pruna_session_${++sessionCounter}_${Date.now()}`;
    this.sessions.set(id, { startTime: Date.now(), entries: [] });
    this.sessionQueue.add(id);
    return id;
  }

  log(sessionId: string, tag: string, message: string, data?: Record<string, unknown>): void {
    this.addEntry(sessionId, 'info', tag, message, data);
  }

  warn(sessionId: string, tag: string, message: string, data?: Record<string, unknown>): void {
    this.addEntry(sessionId, 'warn', tag, message, data);
  }

  error(sessionId: string, tag: string, message: string, data?: Record<string, unknown>): void {
    this.addEntry(sessionId, 'error', tag, message, data);
  }

  getEntries(sessionId: string): LogEntry[] {
    return this.sessions.get(sessionId)?.entries ?? [];
  }

  endSession(sessionId: string): LogEntry[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    const entries = session.entries;
    this.sessions.delete(sessionId);

    // Remove from queue as well (O(1) with Set)
    this.sessionQueue.delete(sessionId);

    return entries;
  }

  private addEntry(
    sessionId: string,
    level: LogEntry['level'],
    tag: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.consoleOutput(level, tag, message, data);
      return;
    }

    const now = Date.now();
    session.entries.push({
      timestamp: now,
      elapsed: now - session.startTime,
      level,
      tag,
      message,
      ...(data && { data }),
    });

    this.consoleOutput(level, tag, message, data);
  }

  private consoleOutput(level: LogEntry['level'], tag: string, message: string, data?: Record<string, unknown>): void {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      fn(`[${tag}] ${message}`, data ?? '');
    }
  }
}

/** Module-level singleton — safe for concurrent sessions via session IDs */
export const generationLogCollector = new GenerationLogCollector();
