/**
 * Pruna Error Types
 * Error handling type definitions
 */

export enum PrunaErrorType {
  NETWORK = "network",
  TIMEOUT = "timeout",
  API_ERROR = "api_error",
  VALIDATION = "validation",
  CONTENT_POLICY = "content_policy",
  RATE_LIMIT = "rate_limit",
  AUTHENTICATION = "authentication",
  QUOTA_EXCEEDED = "quota_exceeded",
  MODEL_NOT_FOUND = "model_not_found",
  FILE_UPLOAD = "file_upload",
  POLLING_TIMEOUT = "polling_timeout",
  INVALID_IMAGE = "invalid_image",
  CANCELLED = "cancelled",
  UNKNOWN = "unknown",
}

export interface PrunaErrorInfo {
  readonly type: PrunaErrorType;
  readonly messageKey: string;
  readonly retryable: boolean;
  readonly originalError: string;
  readonly originalErrorName?: string;
  readonly stack?: string;
  readonly statusCode?: number;
}

