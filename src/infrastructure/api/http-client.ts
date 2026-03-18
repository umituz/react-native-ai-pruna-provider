/**
 * HTTP Client Infrastructure
 * Centralized HTTP request handling with error handling and retry logic
 */

import { ErrorMapperService } from "../../domain/services/error-mapper.domain-service";
import { logger } from "../logging/pruna-logger";

export interface HttpRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | FormData;
  signal?: AbortSignal;
  timeout?: number;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
}

export class HttpClient {
  async request<T>(config: HttpRequestConfig, sessionId: string, tag: string): Promise<HttpResponse<T>> {
    const log = logger;
    const controller = new AbortController();
    const timeoutId = config.timeout ?
      setTimeout(() => controller.abort(), config.timeout) : undefined;

    try {
      log.info(sessionId, tag, `HTTP ${config.method} ${config.url}`, {
        hasBody: !!config.body,
        hasSignal: !!config.signal,
      });

      const response = await fetch(config.url, {
        method: config.method,
        headers: config.headers,
        body: config.body,
        signal: config.signal || controller.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response, sessionId, tag);
      }

      const data = await response.json() as T;
      log.info(sessionId, tag, `HTTP ${response.status} ${response.statusText}`, {
        keys: Object.keys(data as Record<string, unknown>),
      });

      return { data, status: response.status, statusText: response.statusText };

    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      throw this.handleRequestError(error, sessionId, tag);
    }
  }

  private async handleErrorResponse(response: Response, sessionId: string, tag: string): Promise<never> {
    let rawBody = '';
    try {
      rawBody = await response.text();
    } catch {
      // Ignore body read errors
    }

    const errorMessage = this.extractErrorMessage(rawBody) || `HTTP ${response.status}`;
    const error = new Error(errorMessage);
    (error as Error & { statusCode?: number }).statusCode = response.status;

    logger.error(sessionId, tag, `HTTP Error ${response.status}`, {
      statusText: response.statusText,
      errorMessage,
      bodyLength: rawBody.length,
    });

    throw error;
  }

  private handleRequestError(error: unknown, sessionId: string, tag: string): Error {
    if (error instanceof Error && error.name === 'AbortError') {
      const abortError = new Error("Request cancelled by user");
      (abortError as Error & { statusCode?: number }).statusCode = 499;
      return abortError;
    }

    const mappedError = ErrorMapperService.mapError(error);
    logger.error(sessionId, tag, `Request failed: ${mappedError.messageKey}`, {
      originalError: mappedError.originalError,
    });

    return error instanceof Error ? error : new Error(String(error));
  }

  private extractErrorMessage(body: string): string | null {
    if (!body) return null;

    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      return String(parsed.message || parsed.detail || parsed.error || body);
    } catch {
      return body || null;
    }
  }
}

export const httpClient = new HttpClient();
