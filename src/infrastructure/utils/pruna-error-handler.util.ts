/**
 * Pruna Error Handler
 * Maps raw errors to typed PrunaErrorInfo with retryable classification
 */

import { PrunaErrorType } from "../../domain/entities/error.types";
import type { PrunaErrorInfo } from "../../domain/entities/error.types";

/**
 * Map an error to a typed PrunaErrorInfo
 */
export function mapPrunaError(error: unknown): PrunaErrorInfo {
  const originalError = getErrorMessage(error);
  const originalErrorName = error instanceof Error ? error.name : undefined;
  const stack = error instanceof Error ? error.stack : undefined;
  const statusCode = (error as Error & { statusCode?: number }).statusCode;

  // HTTP status code mapping
  if (statusCode !== undefined) {
    return mapStatusCode(statusCode, originalError, originalErrorName, stack);
  }

  // Message pattern matching
  const msg = originalError.toLowerCase();

  if (msg.includes("network") || msg.includes("fetch") || msg.includes("econnrefused") || msg.includes("enotfound")) {
    return buildErrorInfo(PrunaErrorType.NETWORK, "error.pruna.network", true, originalError, originalErrorName, stack);
  }

  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("polling attempts reached")) {
    return buildErrorInfo(PrunaErrorType.POLLING_TIMEOUT, "error.pruna.polling_timeout", true, originalError, originalErrorName, stack);
  }

  if (msg.includes("file upload")) {
    return buildErrorInfo(PrunaErrorType.FILE_UPLOAD, "error.pruna.file_upload", true, originalError, originalErrorName, stack);
  }

  if (msg.includes("invalid image") || msg.includes("invalid character")) {
    return buildErrorInfo(PrunaErrorType.INVALID_IMAGE, "error.pruna.invalid_image", false, originalError, originalErrorName, stack);
  }

  if (msg.includes("cancelled by user")) {
    return buildErrorInfo(PrunaErrorType.UNKNOWN, "error.pruna.cancelled", false, originalError, originalErrorName, stack);
  }

  if (msg.includes("prompt is required") || msg.includes("image is required")) {
    return buildErrorInfo(PrunaErrorType.VALIDATION, "error.pruna.validation", false, originalError, originalErrorName, stack);
  }

  return buildErrorInfo(PrunaErrorType.UNKNOWN, "error.pruna.unknown", false, originalError, originalErrorName, stack);
}

function mapStatusCode(
  statusCode: number,
  originalError: string,
  originalErrorName: string | undefined,
  stack: string | undefined,
): PrunaErrorInfo {
  if (statusCode === 400 || statusCode === 422) {
    return buildErrorInfo(PrunaErrorType.VALIDATION, "error.pruna.validation", false, originalError, originalErrorName, stack, statusCode);
  }
  if (statusCode === 401 || statusCode === 403) {
    return buildErrorInfo(PrunaErrorType.AUTHENTICATION, "error.pruna.authentication", false, originalError, originalErrorName, stack, statusCode);
  }
  if (statusCode === 402) {
    return buildErrorInfo(PrunaErrorType.QUOTA_EXCEEDED, "error.pruna.quota_exceeded", false, originalError, originalErrorName, stack, statusCode);
  }
  if (statusCode === 404) {
    return buildErrorInfo(PrunaErrorType.MODEL_NOT_FOUND, "error.pruna.model_not_found", false, originalError, originalErrorName, stack, statusCode);
  }
  if (statusCode === 429) {
    return buildErrorInfo(PrunaErrorType.RATE_LIMIT, "error.pruna.rate_limit", true, originalError, originalErrorName, stack, statusCode);
  }
  if (statusCode >= 500 && statusCode <= 504) {
    return buildErrorInfo(PrunaErrorType.API_ERROR, "error.pruna.api_error", true, originalError, originalErrorName, stack, statusCode);
  }

  return buildErrorInfo(PrunaErrorType.UNKNOWN, "error.pruna.unknown", false, originalError, originalErrorName, stack, statusCode);
}

function buildErrorInfo(
  type: PrunaErrorType,
  messageKey: string,
  retryable: boolean,
  originalError: string,
  originalErrorName: string | undefined,
  stack: string | undefined,
  statusCode?: number,
): PrunaErrorInfo {
  return {
    type,
    messageKey,
    retryable,
    originalError,
    ...(originalErrorName && { originalErrorName }),
    ...(stack && { stack }),
    ...(statusCode !== undefined && { statusCode }),
  };
}

export function isPrunaErrorRetryable(error: PrunaErrorInfo): boolean {
  return error.retryable;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

export function getErrorMessageOr(error: unknown, fallback: string): string {
  const msg = getErrorMessage(error);
  return msg || fallback;
}

export function formatErrorMessage(error: unknown, context: string): string {
  const msg = getErrorMessage(error);
  return `[${context}] ${msg}`;
}
