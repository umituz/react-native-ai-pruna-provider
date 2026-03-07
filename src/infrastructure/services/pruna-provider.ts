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
import { DEFAULT_PRUNA_CONFIG, PRUNA_CAPABILITIES, VALID_PRUNA_MODELS } from "./pruna-provider.constants";
import { handlePrunaSubscription, handlePrunaRun } from "./pruna-provider-subscription";
import * as queueOps from "./pruna-queue-operations";
import { generationLogCollector } from "../utils/log-collector";
import type { LogEntry } from "../utils/log-collector";
import {
  createRequestKey, getExistingRequest, storeRequest,
  removeRequest, cancelRequest, cancelAllRequests, hasActiveRequests,
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
    generationLogCollector.log(sessionId, 'pruna-provider', `submitJob() for model: ${model}`);
    return queueOps.submitJob(prunaModel, input, apiKey, sessionId);
  }

  async getJobStatus(model: string, requestId: string): Promise<JobStatus> {
    const apiKey = this.validateInit();
    const prunaModel = this.validateModel(model);
    return queueOps.getJobStatus(prunaModel, requestId, apiKey);
  }

  async getJobResult<T = unknown>(model: string, requestId: string): Promise<T> {
    const apiKey = this.validateInit();
    const prunaModel = this.validateModel(model);
    return queueOps.getJobResult<T>(prunaModel, requestId, apiKey);
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
      return existing.promise;
    }

    const abortController = new AbortController();

    let resolvePromise!: (value: T) => void;
    let rejectPromise!: (error: unknown) => void;
    const promise = new Promise<T>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    this.lastRequestKey = key;
    storeRequest(key, { promise, abortController, createdAt: Date.now() });

    handlePrunaSubscription<T>(prunaModel, input, apiKey, sessionId, options, abortController.signal)
      .then((res) => {
        const totalElapsed = Date.now() - totalStart;
        generationLogCollector.log(sessionId, TAG, `Generation SUCCESS in ${totalElapsed}ms`);
        const result = res.result;
        if (result && typeof result === 'object') {
          Object.defineProperty(result, '__providerSessionId', { value: sessionId, enumerable: false });
        }
        resolvePromise(result);
      })
      .catch((error) => {
        const totalElapsed = Date.now() - totalStart;
        generationLogCollector.error(sessionId, TAG, `Generation FAILED in ${totalElapsed}ms: ${error instanceof Error ? error.message : String(error)}`);
        rejectPromise(error);
      })
      .finally(() => {
        try {
          removeRequest(key);
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
      throw new Error("Request cancelled by user");
    }

    const result = await handlePrunaRun<T>(prunaModel, input, apiKey, sessionId, options);
    if (result && typeof result === 'object') {
      Object.defineProperty(result, '__providerSessionId', { value: sessionId, enumerable: false });
    }
    return result;
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
