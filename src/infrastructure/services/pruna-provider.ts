/**
 * Pruna Provider - Implements IAIProvider interface
 * Each subscribe/run call creates an isolated log session via sessionId.
 *
 * Pruna AI models:
 *   p-image:      text-to-image
 *   p-image-edit: image-to-image
 *   p-video:      image-to-video
 */

import type {
  IAIProvider, AIProviderConfig, JobSubmission, JobStatus, SubscribeOptions,
  RunOptions, ProviderCapabilities, ImageFeatureType, VideoFeatureType,
  ImageFeatureInputData, VideoFeatureInputData,
} from "../../domain/types";
import type { PrunaModelId } from "../../domain/entities/pruna.types";
import { PRUNA_CAPABILITIES, VALID_PRUNA_MODELS } from "./pruna-provider.constants";
import { handlePrunaSubscription, handlePrunaRun } from "./pruna-provider-subscription";
import * as queueOps from "./pruna-queue-operations";
import { generationLogCollector } from "../utils/log-collector";
import { calculateElapsedMs } from "../utils/calculation.utils";
import type { LogEntry } from "../utils/log-collector";
import {
  createRequestKey, getExistingRequest, storeRequest,
  removeRequest, cancelRequest, cancelAllRequests, hasActiveRequests,
  storeRequestIdMapping, storeImmediateResultMapping,
  getStatusUrlForRequestId, getResponseUrlForRequestId,
} from "./request-store";

export class PrunaProvider implements IAIProvider {
  readonly providerId = "pruna";
  readonly providerName = "Pruna AI";

  private apiKey: string | null = null;
  private initialized = false;
  private lastRequestKey: string | null = null;

  initialize(config: AIProviderConfig): void {
    this.apiKey = config.apiKey;
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getCapabilities(): ProviderCapabilities {
    return PRUNA_CAPABILITIES;
  }

  isFeatureSupported(_feature: ImageFeatureType | VideoFeatureType): boolean {
    return false;
  }

  getImageFeatureModel(_feature: ImageFeatureType): string {
    throw new Error("Feature-specific models not supported. Use main app's feature implementations.");
  }

  buildImageFeatureInput(_feature: ImageFeatureType, _data: ImageFeatureInputData): Record<string, unknown> {
    throw new Error("Feature-specific input building not supported. Use main app's feature implementations.");
  }

  getVideoFeatureModel(_feature: VideoFeatureType): string {
    throw new Error("Feature-specific models not supported. Use main app's feature implementations.");
  }

  buildVideoFeatureInput(_feature: VideoFeatureType, _data: VideoFeatureInputData): Record<string, unknown> {
    throw new Error("Feature-specific input building not supported. Use main app's feature implementations.");
  }

  private validateInit(): string {
    if (!this.apiKey || !this.initialized) {
      throw new Error("Pruna provider not initialized. Call initialize() first.");
    }
    return this.apiKey;
  }

  private validateModel(model: string): PrunaModelId {
    if (!VALID_PRUNA_MODELS.includes(model as PrunaModelId)) {
      throw new Error(
        `Invalid Pruna model: "${model}". Valid models: ${VALID_PRUNA_MODELS.join(', ')}`
      );
    }
    return model as PrunaModelId;
  }

  async submitJob(model: string, input: Record<string, unknown>): Promise<JobSubmission> {
    const apiKey = this.validateInit();
    const prunaModel = this.validateModel(model);
    const sessionId = generationLogCollector.startSession();
    generationLogCollector.log(sessionId, 'pruna-provider', `submitJob() START model: ${model}`);
    try {
      const submission = await queueOps.submitJob(prunaModel, input, apiKey, sessionId);

      // Log response type
      if (submission.responseUrl) {
        const responseUrlPreview = submission.responseUrl.length > 80
          ? `${submission.responseUrl.substring(0, 80)}...`
          : submission.responseUrl;
        generationLogCollector.log(sessionId, 'pruna-provider', `submitJob() IMMEDIATE RESULT - requestId: ${submission.requestId}, responseUrl: ${responseUrlPreview}`);
        // Store requestId -> responseUrl mapping for immediate results (already complete)
        storeImmediateResultMapping(submission.requestId, submission.responseUrl, model);
        generationLogCollector.log(sessionId, 'pruna-provider', `submitJob() Stored immediate result mapping: ${submission.requestId}`);
      } else if (submission.statusUrl) {
        const statusUrlPreview = submission.statusUrl.length > 80
          ? `${submission.statusUrl.substring(0, 80)}...`
          : submission.statusUrl;
        generationLogCollector.log(sessionId, 'pruna-provider', `submitJob() ASYNC JOB - requestId: ${submission.requestId}, statusUrl: ${statusUrlPreview}`);
        // Store requestId -> statusUrl mapping for async jobs (requires polling)
        storeRequestIdMapping(submission.requestId, submission.statusUrl, model);
        generationLogCollector.log(sessionId, 'pruna-provider', `submitJob() Stored async job mapping: ${submission.requestId}`);
      } else {
        generationLogCollector.warn(sessionId, 'pruna-provider', `submitJob() WARNING - No responseUrl or statusUrl in submission`);
      }

      generationLogCollector.log(sessionId, 'pruna-provider', `submitJob() COMPLETE - returning submission with requestId: ${submission.requestId}`);
      return submission;
    } finally {
      generationLogCollector.endSession(sessionId);
    }
  }

  async getJobStatus(model: string, requestId: string): Promise<JobStatus> {
    const apiKey = this.validateInit();
    const prunaModel = this.validateModel(model);
    const sessionId = generationLogCollector.startSession();
    generationLogCollector.log(sessionId, 'pruna-provider', `getJobStatus() START - model: ${model}, requestId: ${requestId}`);

    try {
      // Check if this is an immediate result (already completed)
      const responseUrl = getResponseUrlForRequestId(requestId);
      if (responseUrl) {
        generationLogCollector.log(sessionId, 'pruna-provider', `getJobStatus() FOUND immediate result for ${requestId} - returning COMPLETED`);
        generationLogCollector.endSession(sessionId);
        // Result is already available
        return {
          status: "COMPLETED",
          requestId,
        };
      }

      // Look up statusUrl from requestId mapping (async job)
      const statusUrl = getStatusUrlForRequestId(requestId);
      if (statusUrl) {
        generationLogCollector.log(sessionId, 'pruna-provider', `getJobStatus() FOUND async job for ${requestId} - polling statusUrl: ${statusUrl.substring(0, 80)}...`);
        const result = await queueOps.getJobStatus(prunaModel, statusUrl, apiKey);
        generationLogCollector.log(sessionId, 'pruna-provider', `getJobStatus() Poll result: ${result.status}`);
        generationLogCollector.endSession(sessionId);
        return result;
      }

      // Fallback: assume requestId is actually a statusUrl (for direct calls with statusUrl)
      generationLogCollector.log(sessionId, 'pruna-provider', `getJobStatus() NO mapping found - treating ${requestId} as statusUrl directly`);
      const result = await queueOps.getJobStatus(prunaModel, requestId, apiKey);
      generationLogCollector.log(sessionId, 'pruna-provider', `getJobStatus() Direct poll result: ${result.status}`);
      generationLogCollector.endSession(sessionId);
      return result;
    } catch (error) {
      generationLogCollector.error(sessionId, 'pruna-provider', `getJobStatus() ERROR: ${error instanceof Error ? error.message : String(error)}`);
      generationLogCollector.endSession(sessionId);
      throw error;
    }
  }

  async getJobResult<T = unknown>(model: string, requestId: string): Promise<T> {
    const apiKey = this.validateInit();
    const prunaModel = this.validateModel(model);
    const sessionId = generationLogCollector.startSession();
    generationLogCollector.log(sessionId, 'pruna-provider', `getJobResult() START - model: ${model}, requestId: ${requestId}`);

    try {
      // Check if this is an immediate result (already completed)
      const responseUrl = getResponseUrlForRequestId(requestId);
      if (responseUrl) {
        generationLogCollector.log(sessionId, 'pruna-provider', `getJobResult() FOUND immediate result for ${requestId} - returning output: ${responseUrl.substring(0, 80)}...`);
        generationLogCollector.endSession(sessionId);
        // Return the immediate result in expected format for extractResultUrl
        return { output: responseUrl } as T;
      }

      // Look up statusUrl from requestId mapping (async job)
      const statusUrl = getStatusUrlForRequestId(requestId);
      if (statusUrl) {
        generationLogCollector.log(sessionId, 'pruna-provider', `getJobResult() FOUND async job for ${requestId} - fetching from statusUrl: ${statusUrl.substring(0, 80)}...`);
        const result = await queueOps.getJobResult<T>(prunaModel, statusUrl, apiKey);
        generationLogCollector.log(sessionId, 'pruna-provider', `getJobResult() Fetch complete`);
        generationLogCollector.endSession(sessionId);
        return result;
      }

      // Fallback: assume requestId is actually a statusUrl (for direct calls with statusUrl)
      generationLogCollector.log(sessionId, 'pruna-provider', `getJobResult() NO mapping found - treating ${requestId} as statusUrl directly`);
      const result = await queueOps.getJobResult<T>(prunaModel, requestId, apiKey);
      generationLogCollector.log(sessionId, 'pruna-provider', `getJobResult() Direct fetch complete`);
      generationLogCollector.endSession(sessionId);
      return result;
    } catch (error) {
      generationLogCollector.error(sessionId, 'pruna-provider', `getJobResult() ERROR: ${error instanceof Error ? error.message : String(error)}`);
      generationLogCollector.endSession(sessionId);
      throw error;
    }
  }

  async subscribe<T = unknown>(
    model: string,
    input: Record<string, unknown>,
    options?: SubscribeOptions<T>,
  ): Promise<T> {
    const TAG = 'pruna-provider';
    const totalStart = Date.now();
    const apiKey = this.validateInit();
    const prunaModel = this.validateModel(model);

    const sessionId = generationLogCollector.startSession();
    generationLogCollector.log(sessionId, TAG, `subscribe() called for model: ${model}`);

    const key = createRequestKey(model, input);

    const existing = getExistingRequest<T>(key);
    if (existing) {
      generationLogCollector.log(sessionId, TAG, `Dedup hit — returning existing request`);
      generationLogCollector.endSession(sessionId); // Clean up unused session
      return existing.promise;
    }

    const abortController = new AbortController();

    let resolvePromise!: (value: T) => void;
    let rejectPromise!: (error: unknown) => void;
    const promise = new Promise<T>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    // Store request BEFORE starting async operation to prevent race conditions
    // Use the unique key for this specific request
    storeRequest(key, { promise, abortController, createdAt: Date.now() });

    // Track this as the current request for cancellation
    this.lastRequestKey = key;

    // Capture this request's key for cleanup in finally block
    // This prevents race condition where rapid successive calls
    // could cause cleanup to remove wrong request
    const thisRequestKey = key;

    handlePrunaSubscription<T>(prunaModel, input, apiKey, sessionId, options, abortController.signal)
      .then((res) => {
        const totalElapsed = calculateElapsedMs(totalStart);
        generationLogCollector.log(sessionId, TAG, `Generation SUCCESS in ${totalElapsed}ms`);
        const result = res.result;
        if (result && typeof result === 'object') {
          Object.defineProperty(result, '__providerSessionId', { value: sessionId, enumerable: false });
        }
        resolvePromise(result);
      })
      .catch((error) => {
        const totalElapsed = calculateElapsedMs(totalStart);
        generationLogCollector.error(sessionId, TAG, `Generation FAILED in ${totalElapsed}ms: ${error instanceof Error ? error.message : String(error)}`);
        generationLogCollector.endSession(sessionId); // Clean up session on error
        rejectPromise(error);
      })
      .finally(() => {
        try {
          // Only remove if this is still the correct request
          // This prevents removing a newer request with same key
          const storedRequest = getExistingRequest<T>(thisRequestKey);
          if (storedRequest && storedRequest.promise === promise) {
            removeRequest(thisRequestKey);
          }
        } catch (cleanupError) {
          generationLogCollector.warn(sessionId, TAG, `Error removing request: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
        }
      });

    return promise;
  }

  async run<T = unknown>(model: string, input: Record<string, unknown>, options?: RunOptions): Promise<T> {
    const apiKey = this.validateInit();
    const prunaModel = this.validateModel(model);

    const sessionId = generationLogCollector.startSession();
    generationLogCollector.log(sessionId, 'pruna-provider', `run() for model: ${model}`);

    const signal = options?.signal;
    if (signal?.aborted) {
      generationLogCollector.endSession(sessionId);
      throw new Error("Request cancelled by user");
    }

    try {
      const result = await handlePrunaRun<T>(prunaModel, input, apiKey, sessionId, options);
      if (result && typeof result === 'object') {
        Object.defineProperty(result, '__providerSessionId', { value: sessionId, enumerable: false });
      }
      return result;
    } finally {
      generationLogCollector.endSession(sessionId);
    }
  }

  reset(): void {
    cancelAllRequests();
    this.lastRequestKey = null;
    this.apiKey = null;
    this.initialized = false;
  }

  cancelCurrentRequest(): void {
    if (this.lastRequestKey) {
      cancelRequest(this.lastRequestKey);
      this.lastRequestKey = null;
    }
  }

  hasRunningRequest(): boolean {
    return hasActiveRequests();
  }

  getSessionLogs(sessionId?: string): LogEntry[] {
    if (!sessionId) return [];
    return generationLogCollector.getEntries(sessionId);
  }

  endLogSession(sessionId?: string): LogEntry[] {
    if (!sessionId) return [];
    return generationLogCollector.endSession(sessionId);
  }
}

export const prunaProvider = new PrunaProvider();
