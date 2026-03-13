/**
 * usePrunaGeneration Hook
 * React hook for Pruna AI generation operations
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { prunaProvider } from "../../infrastructure/services/pruna-provider";
import { mapPrunaError } from "../../infrastructure/utils/pruna-error-handler.util";
import { PrunaGenerationStateManager } from "../../infrastructure/utils/pruna-generation-state-manager.util";
import type { PrunaJobInput, PrunaQueueStatus } from "../../domain/entities/pruna.types";
import type { PrunaErrorInfo } from "../../domain/entities/error.types";
import type { JobStatus, AILogEntry } from "../../domain/types";

export interface UsePrunaGenerationOptions {
  timeoutMs?: number;
  onProgress?: (status: PrunaQueueStatus) => void;
  onError?: (error: PrunaErrorInfo) => void;
}

export interface UsePrunaGenerationResult<T> {
  data: T | null;
  error: PrunaErrorInfo | null;
  isLoading: boolean;
  isRetryable: boolean;
  requestId: string | null;
  isCancelling: boolean;
  generate: (model: string, input: PrunaJobInput) => Promise<T | null>;
  retry: () => Promise<T | null>;
  cancel: () => void;
  reset: () => void;
}

function convertJobStatusToPrunaQueueStatus(status: JobStatus, currentRequestId: string | null): PrunaQueueStatus {
  return {
    status: status.status as PrunaQueueStatus["status"],
    requestId: status.requestId ?? currentRequestId ?? "",
    logs: status.logs?.map((log: AILogEntry) => ({
      message: log.message,
      level: log.level,
      timestamp: log.timestamp,
    })),
  };
}

export function usePrunaGeneration<T = unknown>(
  options?: UsePrunaGenerationOptions
): UsePrunaGenerationResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<PrunaErrorInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  const stateManagerRef = useRef<PrunaGenerationStateManager<T> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const stateManager = new PrunaGenerationStateManager<T>({
      onProgress: (status) => {
        optionsRef.current?.onProgress?.(status);
      },
    });

    stateManager.setIsMounted(true);
    stateManagerRef.current = stateManager;

    return () => {
      if (stateManagerRef.current) {
        stateManagerRef.current.setIsMounted(false);
        stateManagerRef.current = null;
      }

      // Cancel this hook's active request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Also cancel the provider's internal request
      prunaProvider.cancelCurrentRequest();
    };
  }, []);

  const generate = useCallback(
    async (model: string, input: PrunaJobInput): Promise<T | null> => {
      const stateManager = stateManagerRef.current;
      if (!stateManager || !stateManager.checkMounted()) return null;

      // Cancel any previous in-flight request from this hook
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      stateManager.setLastRequest(model, input);
      setIsLoading(true);
      setError(null);
      setData(null);
      setRequestId(null);
      stateManager.setCurrentRequestId(null);
      setIsCancelling(false);

      // Capture current timeout value at the start of generation
      const timeoutMs = optionsRef.current?.timeoutMs;

      try {
        const result = await prunaProvider.subscribe<T>(model, input, {
          timeoutMs,
          onQueueUpdate: (status: JobStatus) => {
            const prunaStatus = convertJobStatusToPrunaQueueStatus(
              status,
              stateManager.getCurrentRequestId()
            );
            stateManager.handleQueueUpdate(prunaStatus);

            // Update reactive requestId from queue status
            if (status.requestId) {
              setRequestId(status.requestId);
            }
          },
        });

        if (!stateManager.checkMounted()) return null;
        setData(result);
        return result;
      } catch (err) {
        if (!stateManager.checkMounted()) return null;
        const errorInfo = mapPrunaError(err);
        setError(errorInfo);
        optionsRef.current?.onError?.(errorInfo);
        return null;
      } finally {
        if (stateManager.checkMounted()) {
          setIsLoading(false);
          setIsCancelling(false);
        }
        // Clean up controller reference
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    []
  );

  const retry = useCallback(async (): Promise<T | null> => {
    const stateManager = stateManagerRef.current;
    if (!stateManager) return null;

    const lastRequest = stateManager.getLastRequest();
    if (!lastRequest) return null;

    return generate(lastRequest.endpoint, lastRequest.input);
  }, [generate]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      setIsCancelling(true);
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Propagate cancel to the provider's internal AbortController
    prunaProvider.cancelCurrentRequest();
  }, []);

  const reset = useCallback(() => {
    cancel();
    setData(null);
    setError(null);
    setIsLoading(false);
    setIsCancelling(false);
    setRequestId(null);
    stateManagerRef.current?.clearLastRequest();
  }, [cancel]);

  return {
    data,
    error,
    isLoading,
    isRetryable: error?.retryable ?? false,
    requestId,
    isCancelling,
    generate,
    retry,
    cancel,
    reset,
  };
}
