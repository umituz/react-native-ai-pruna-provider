/**
 * Pruna Provider Subscription Handlers
 * Handles subscribe and run methods with retry, timeout, and cancellation
 *
 * Retry strategy for subscribe:
 * - Retries on: network errors, timeouts, server errors (5xx)
 * - NO retry on: auth, validation, quota, user cancellation
 * - Max 1 retry (2 total attempts) with 3s delay
 */

import type { PrunaModelId } from "../../domain/entities/pruna.types";
import type { SubscribeOptions, RunOptions } from "../../domain/types";
import { DEFAULT_PRUNA_CONFIG } from "./pruna-provider.constants";
import { submitPrediction, extractUri, resolveUri, pollForResult } from "./pruna-api-client";
import { buildModelInput } from "./pruna-input-builder";
import { generationLogCollector } from "../utils/log-collector";

const TAG = 'pruna-subscription';

// ─── Helpers ────────────────────────────────────────────────────────────────

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error && error.message.includes("cancelled by user")) return false;

  // Check HTTP status code if attached
  const statusCode = (error as Error & { statusCode?: number }).statusCode;
  if (statusCode !== undefined) {
    if (statusCode >= 500 && statusCode <= 504) return true;
    return false; // 4xx are not retryable
  }

  // Generic Error — check message patterns
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network")) return true;
    if (msg.includes("timeout") || msg.includes("timed out")) return true;
    if (msg.includes("fetch")) return true;
    if (msg.includes("econnrefused") || msg.includes("enotfound")) return true;
  }

  return false;
}

// ─── Single Subscribe Attempt ───────────────────────────────────────────────

async function singleSubscribeAttempt<T = unknown>(
  model: PrunaModelId,
  input: Record<string, unknown>,
  apiKey: string,
  sessionId: string,
  options: SubscribeOptions<T> | undefined,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<{ result: T; requestId: string }> {
  if (signal?.aborted) {
    throw new Error("Request cancelled by user");
  }

  // Build model-specific input
  const modelInput = await buildModelInput(model, input, apiKey, sessionId);

  // Race between prediction and timeout
  const predictionPromise = (async (): Promise<string> => {
    // Notify progress: IN_PROGRESS
    options?.onProgress?.({ progress: -1, status: "IN_PROGRESS" });

    const response = await submitPrediction(model, modelInput, apiKey, sessionId, signal);
    let uri = extractUri(response);

    // __DEV__ log extracted URI
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[DEV] [${TAG}] Extracted URI:`, {
        hasUri: !!uri,
        uri: uri?.substring(0, 100) + '...',
        uriFull: uri,
        responseKeys: Object.keys(response),
        status: response.status,
      });
    }

    // If no immediate result, poll for async result
    if (!uri && (response.get_url || response.status_url)) {
      const pollUrl = response.get_url || response.status_url;
      if (!pollUrl) {
        throw new Error("Pruna API response missing polling URL");
      }

      generationLogCollector.log(sessionId, TAG, 'No immediate result — starting async polling...');
      options?.onQueueUpdate?.({
        status: "IN_QUEUE",
        requestId: pollUrl,
      });

      uri = await pollForResult(
        pollUrl,
        apiKey,
        sessionId,
        DEFAULT_PRUNA_CONFIG.maxPollAttempts,
        DEFAULT_PRUNA_CONFIG.pollIntervalMs,
        signal,
      );
    }

    if (!uri) {
      throw new Error("Empty result from Pruna AI. Please try again.");
    }

    const resolvedUri = resolveUri(uri);

    // __DEV__ log final result
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[DEV] [${TAG}] Returning URI:`, {
        originalUri: uri,
        resolvedUri,
        resolvedUriPrefix: resolvedUri.substring(0, 100) + '...',
      });
    }

    return resolvedUri;
  })();

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Pruna subscription timeout after ${timeoutMs}ms for model ${model}`));
    }, timeoutMs);

    // Cleanup timeout if prediction finishes first
    predictionPromise.finally(() => clearTimeout(timeoutId));
  });

  const promises: Promise<unknown>[] = [predictionPromise, timeoutPromise];

  if (signal) {
    const abortPromise = new Promise<never>((_, reject) => {
      const handler = () => reject(new Error("Request cancelled by user"));
      signal.addEventListener("abort", handler, { once: true });
      predictionPromise.finally(() => signal.removeEventListener("abort", handler));
    });
    promises.push(abortPromise);
    // Prevent unhandled rejection if abort loses the race
    abortPromise.catch(() => {});

    if (signal.aborted) {
      throw new Error("Request cancelled by user");
    }
  }

  // Prevent unhandled rejections for promises that lose the race
  // (e.g. timeout fires after abort wins → would cause React Native red screen)
  predictionPromise.catch(() => {});
  timeoutPromise.catch(() => {});

  const resultUrl = await Promise.race(promises) as string;
  const requestId = `pruna_${model}_${Date.now()}`;

  // Notify progress: COMPLETED
  options?.onProgress?.({ progress: 100, status: "COMPLETED" });
  options?.onQueueUpdate?.({
    status: "COMPLETED",
    requestId,
  });

  // Wrap result in expected format for AI generation content
  // Pruna returns a URL string — wrap in { images: [{ url }] } format
  const result = { images: [{ url: resultUrl }] } as T;

  generationLogCollector.log(sessionId, TAG, `Result wrapped for AI generation content`, {
    format: 'images: [{ url }]',
    urlPrefix: resultUrl.substring(0, 80) + '...',
  });

  return { result, requestId };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Handle Pruna subscription with timeout, cancellation, and retry.
 */
export async function handlePrunaSubscription<T = unknown>(
  model: PrunaModelId,
  input: Record<string, unknown>,
  apiKey: string,
  sessionId: string,
  options?: SubscribeOptions<T>,
  signal?: AbortSignal,
): Promise<{ result: T; requestId: string }> {
  const overallStart = Date.now();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_PRUNA_CONFIG.defaultTimeoutMs;
  const maxRetries = DEFAULT_PRUNA_CONFIG.subscribeMaxRetries;
  const retryDelay = DEFAULT_PRUNA_CONFIG.subscribeRetryDelayMs;

  generationLogCollector.log(sessionId, TAG, `Starting subscription for model: ${model}`, {
    timeoutMs,
    maxRetries,
    inputKeys: Object.keys(input),
  });

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 3600000) {
    throw new Error(
      `Invalid timeout: ${timeoutMs}ms. Must be a positive integer between 1 and 3600000ms (1 hour)`
    );
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      generationLogCollector.warn(sessionId, TAG, `Retry ${attempt}/${maxRetries} after ${retryDelay}ms delay...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));

      if (signal?.aborted) {
        throw new Error("Request cancelled by user");
      }
    }

    try {
      generationLogCollector.log(sessionId, TAG, `Attempt ${attempt + 1}/${maxRetries + 1} starting...`);

      const result = await singleSubscribeAttempt<T>(
        model, input, apiKey, sessionId, options, signal, timeoutMs,
      );

      const totalElapsed = Date.now() - overallStart;
      const suffix = attempt > 0 ? ` (succeeded on retry ${attempt})` : '';
      generationLogCollector.log(sessionId, TAG, `Subscription completed in ${totalElapsed}ms${suffix}. Request ID: ${result.requestId}`);

      return result;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);

      if (attempt < maxRetries && isRetryableError(error)) {
        generationLogCollector.warn(sessionId, TAG, `Attempt ${attempt + 1} failed (retryable): ${message}`);
        continue;
      }

      const totalElapsed = Date.now() - overallStart;
      const retryInfo = attempt > 0 ? ` after ${attempt + 1} attempts` : '';
      generationLogCollector.error(sessionId, TAG, `Subscription FAILED in ${totalElapsed}ms${retryInfo}: ${message}`);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  // Unreachable: loop always returns or throws. TypeScript safety net.
  throw lastError instanceof Error ? lastError : new Error("Subscription failed after all retry attempts.");
}

/**
 * Handle Pruna run (no retry — direct execution)
 */
export async function handlePrunaRun<T = unknown>(
  model: PrunaModelId,
  input: Record<string, unknown>,
  apiKey: string,
  sessionId: string,
  options?: RunOptions,
): Promise<T> {
  const runTag = 'pruna-run';
  const startTime = Date.now();
  generationLogCollector.log(sessionId, runTag, `Starting run for model: ${model}`);

  options?.onProgress?.({ progress: -1, status: "IN_PROGRESS" as const });

  try {
    const modelInput = await buildModelInput(model, input, apiKey, sessionId);
    const response = await submitPrediction(model, modelInput, apiKey, sessionId, options?.signal);

    let uri = extractUri(response);

    // Poll if needed
    if (!uri && (response.get_url || response.status_url)) {
      const pollUrl = response.get_url || response.status_url;
      if (!pollUrl) {
        throw new Error("Pruna API response missing polling URL");
      }
      uri = await pollForResult(
        pollUrl,
        apiKey,
        sessionId,
        DEFAULT_PRUNA_CONFIG.maxPollAttempts,
        DEFAULT_PRUNA_CONFIG.pollIntervalMs,
        options?.signal,
      );
    }

    if (!uri) {
      throw new Error("Empty result from Pruna AI. Please try again.");
    }

    const resultUrl = resolveUri(uri);
    const elapsed = Date.now() - startTime;
    generationLogCollector.log(sessionId, runTag, `Run completed in ${elapsed}ms`);

    options?.onProgress?.({ progress: 100, status: "COMPLETED" as const });

    // Wrap result in expected format for AI generation content
    return { images: [{ url: resultUrl }] } as T;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    generationLogCollector.error(sessionId, runTag, `Run FAILED after ${elapsed}ms for model ${model}: ${message}`);
    throw error instanceof Error ? error : new Error(message);
  }
}
