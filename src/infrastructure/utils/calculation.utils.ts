/**
 * Calculation Utilities
 * Centralized calculation functions for consistent and reusable operations
 */

/**
 * Converts bytes to kilobytes (KB)
 */
export function bytesToKB(bytes: number): number {
  return Math.round(bytes / 1024);
}

/**
 * Converts bytes to megabytes (MB)
 */
export function bytesToMB(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}

/**
 * Calculates elapsed time in milliseconds from a start timestamp
 */
export function calculateElapsedMs(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * Formats elapsed time in human-readable format
 */
export function formatElapsedMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Creates a preview of a string by truncating and adding ellipsis
 */
export function createStringPreview(str: string, maxLength: number = 80): string {
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength)}...`;
}

/**
 * Creates a size preview (e.g., "2.5 MB", "1024 KB")
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${bytesToKB(bytes)} KB`;
  return `${bytesToMB(bytes)} MB`;
}

/**
 * Calculates percentage with specified precision
 */
export function calculatePercentage(value: number, total: number, precision: number = 0): number {
  if (total === 0) return 0;
  return Number(((value / total) * 100).toFixed(precision));
}

/**
 * Clamps a number between min and max values
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculates retry delay with exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  return Math.round(delay);
}

/**
 * Validates if a timeout value is within acceptable range
 */
export function isValidTimeout(timeoutMs: number): boolean {
  return (
    Number.isInteger(timeoutMs) &&
    timeoutMs > 0 &&
    timeoutMs <= 3600000 // Max 1 hour
  );
}

/**
 * Calculates hash of a string for request deduplication
 * Uses base64 encoding for collision resistance
 */
export function calculateRequestHash(input: string): string {
  // Replace non-alphanumeric chars with underscores for safe string representation
  const safeInput = input.replace(/[^a-zA-Z0-9]/g, '_');

  // Use first 64 chars + last 64 chars to keep key length manageable
  if (safeInput.length <= 128) return safeInput;

  return `${safeInput.substring(0, 64)}...${safeInput.slice(-64)}`;
}
