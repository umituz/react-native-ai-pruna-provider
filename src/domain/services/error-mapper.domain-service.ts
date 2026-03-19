/**
 * Error Mapper Domain Service
 * Maps raw errors to domain-specific error types
 */

import { PrunaErrorType } from "../entities/error.types";
import type { PrunaErrorInfo } from "../entities/error.types";

export class ErrorMapperService {
  static mapError(error: unknown): PrunaErrorInfo {
    const originalMessage = this.extractMessage(error);
    const errorName = error instanceof Error ? error.name : undefined;
    const stack = error instanceof Error ? error.stack : undefined;
    const statusCode = (error as Error & { statusCode?: number }).statusCode;

    // Check for specific error types
    if (error instanceof Error && error.name === 'AbortError') {
      return this.buildError(
        PrunaErrorType.CANCELLED,
        "Request cancelled by user",
        false,
        originalMessage,
        errorName,
        stack,
        statusCode
      );
    }

    // HTTP status code mapping
    if (statusCode !== undefined) {
      return this.mapStatusCode(statusCode, originalMessage, errorName, stack);
    }

    // Message pattern matching
    return this.mapByMessage(originalMessage, errorName, stack);
  }

  static isRetryable(error: PrunaErrorInfo): boolean {
    return error.retryable;
  }

  private static mapStatusCode(
    statusCode: number,
    message: string,
    errorName?: string,
    stack?: string
  ): PrunaErrorInfo {
    const statusMap: Record<number, { type: PrunaErrorType; messageKey: string; retryable: boolean }> = {
      400: { type: PrunaErrorType.VALIDATION, messageKey: "error.validation", retryable: false },
      401: { type: PrunaErrorType.AUTHENTICATION, messageKey: "error.auth", retryable: false },
      402: { type: PrunaErrorType.QUOTA_EXCEEDED, messageKey: "error.quota", retryable: false },
      403: { type: PrunaErrorType.AUTHENTICATION, messageKey: "error.auth", retryable: false },
      404: { type: PrunaErrorType.MODEL_NOT_FOUND, messageKey: "error.model_not_found", retryable: false },
      422: { type: PrunaErrorType.VALIDATION, messageKey: "error.validation", retryable: false },
      429: { type: PrunaErrorType.RATE_LIMIT, messageKey: "error.rate_limit", retryable: true },
    };

    const mapped = statusMap[statusCode];
    if (mapped) {
      return this.buildError(
        mapped.type,
        mapped.messageKey,
        mapped.retryable,
        message,
        errorName,
        stack,
        statusCode
      );
    }

    // Server errors (5xx)
    if (statusCode >= 500 && statusCode <= 504) {
      return this.buildError(
        PrunaErrorType.API_ERROR,
        "error.api",
        true,
        message,
        errorName,
        stack,
        statusCode
      );
    }

    return this.buildError(
      PrunaErrorType.UNKNOWN,
      "error.unknown",
      false,
      message,
      errorName,
      stack,
      statusCode
    );
  }

  private static mapByMessage(
    message: string,
    errorName?: string,
    stack?: string
  ): PrunaErrorInfo {
    const msg = message.toLowerCase();

    // Network errors
    if (this.matchesAny(msg, ["network", "fetch", "econnrefused", "enotfound"])) {
      return this.buildError(
        PrunaErrorType.NETWORK,
        "error.network",
        true,
        message,
        errorName,
        stack
      );
    }

    // Timeout errors
    if (this.matchesAny(msg, ["timeout", "timed out", "polling attempts reached"])) {
      return this.buildError(
        PrunaErrorType.POLLING_TIMEOUT,
        "error.timeout",
        true,
        message,
        errorName,
        stack
      );
    }

    // File upload errors
    if (msg.includes("file upload")) {
      return this.buildError(
        PrunaErrorType.FILE_UPLOAD,
        "error.file_upload",
        true,
        message,
        errorName,
        stack
      );
    }

    // Validation errors
    if (this.matchesAny(msg, ["prompt is required", "image is required", "invalid"])) {
      return this.buildError(
        PrunaErrorType.VALIDATION,
        "error.validation",
        false,
        message,
        errorName,
        stack
      );
    }

    // Cancellation
    if (msg.includes("cancelled by user")) {
      return this.buildError(
        PrunaErrorType.CANCELLED,
        "error.cancelled",
        false,
        message,
        errorName,
        stack
      );
    }

    return this.buildError(
      PrunaErrorType.UNKNOWN,
      "error.unknown",
      false,
      message,
      errorName,
      stack
    );
  }

  private static buildError(
    type: PrunaErrorType,
    messageKey: string,
    retryable: boolean,
    originalError: string,
    originalErrorName?: string,
    stack?: string,
    statusCode?: number
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

  private static extractMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return String(error);
  }

  private static matchesAny(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }
}
