/**
 * Calculation Utilities
 * Internal calculation functions for Pruna provider
 */

import { DEFAULT_PRUNA_CONFIG } from "../services/pruna-provider.constants";

/** Maximum timeout value (1 hour) - exported for validation functions */
export const MAX_TIMEOUT_MS = DEFAULT_PRUNA_CONFIG.maxTimeoutMs;

/** Default maximum length for string previews and truncation */
export const DEFAULT_MAX_LENGTH = 80;

/**
 * Converts bytes to kilobytes (KB)
 */
export function bytesToKB(bytes: number): number {
  return Math.round(bytes / 1024);
}

/**
 * Converts bytes to megabytes (MB)
 */
function bytesToMB(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}

/**
 * Calculates elapsed time in milliseconds from a start timestamp
 */
export function calculateElapsedMs(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * Creates a preview of a string by truncating and adding ellipsis
 */
export function createStringPreview(str: string, maxLength: number = DEFAULT_MAX_LENGTH): string {
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength)}...`;
}

/**
 * Calculates percentage with specified precision
 */
export function calculatePercentage(value: number, total: number, precision: number = 0): number {
  if (total === 0) return 0;
  return Number(((value / total) * 100).toFixed(precision));
}

/**
 * Validates if a timeout value is within acceptable range
 */
export function isValidTimeout(timeoutMs: number): boolean {
  return (
    Number.isInteger(timeoutMs) &&
    timeoutMs > 0 &&
    timeoutMs <= MAX_TIMEOUT_MS
  );
}
