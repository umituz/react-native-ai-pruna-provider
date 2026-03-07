/**
 * Pruna Generation State Manager
 * Manages state and refs for Pruna generation operations
 */

import type { PrunaJobInput, PrunaLogEntry, PrunaQueueStatus } from "../../domain/entities/pruna.types";

export interface GenerationState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isCancelling: boolean;
  requestId: string | null;
  lastRequest: { endpoint: string; input: PrunaJobInput } | null;
}

export interface GenerationStateOptions<T> {
  onQueueUpdate?: (status: PrunaQueueStatus) => void;
  onProgress?: (status: PrunaQueueStatus) => void;
  onError?: (error: Error) => void;
  onResult?: (result: T) => void;
}

export class PrunaGenerationStateManager<T> {
  private isMounted = true;
  private currentRequestId: string | null = null;
  private lastRequest: { endpoint: string; input: PrunaJobInput } | null = null;
  private lastNotifiedStatus: string | null = null;

  constructor(
    private options?: GenerationStateOptions<T>
  ) {}

  setIsMounted(mounted: boolean): void {
    this.isMounted = mounted;
  }

  checkMounted(): boolean {
    return this.isMounted;
  }

  setCurrentRequestId(requestId: string | null): void {
    this.currentRequestId = requestId;
  }

  getCurrentRequestId(): string | null {
    return this.currentRequestId;
  }

  setLastRequest(endpoint: string, input: PrunaJobInput): void {
    this.lastRequest = { endpoint, input };
  }

  getLastRequest(): { endpoint: string; input: PrunaJobInput } | null {
    return this.lastRequest;
  }

  clearLastRequest(): void {
    this.lastRequest = null;
    this.currentRequestId = null;
    this.lastNotifiedStatus = null;
  }

  handleQueueUpdate(status: PrunaQueueStatus): void {
    if (!this.isMounted) return;

    if (status.requestId) {
      this.currentRequestId = status.requestId;
    }

    const normalizedStatus: PrunaQueueStatus = {
      status: status.status,
      requestId: status.requestId ?? this.currentRequestId ?? "",
      logs: status.logs?.map((log: PrunaLogEntry) => ({
        message: log.message,
        level: log.level,
        timestamp: log.timestamp,
      })),
    };

    const statusKey = `${normalizedStatus.status}-${normalizedStatus.requestId}`;
    if (this.lastNotifiedStatus !== statusKey) {
      this.lastNotifiedStatus = statusKey;
      this.options?.onQueueUpdate?.(normalizedStatus);
      this.options?.onProgress?.(normalizedStatus);
    }
  }

  handleResult(result: T): void {
    if (!this.isMounted) return;
    this.options?.onResult?.(result);
  }

  handleError(error: Error): void {
    if (!this.isMounted) return;
    this.options?.onError?.(error);
  }
}
