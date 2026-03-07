/**
 * Pruna Provider Constants
 * Configuration and capability definitions for Pruna AI provider
 *
 * Retry Strategy:
 * ┌──────────────────────────────────────────────────┐
 * │ FILE UPLOAD (Pruna /v1/files)                    │
 * │ Timeout: 30s / attempt                           │
 * │ Retries: 2 (3 total attempts)                    │
 * │ Backoff: 1s → 2s (exponential)                   │
 * │ Retries on: network, timeout                     │
 * ├──────────────────────────────────────────────────┤
 * │ PREDICTION (Pruna /v1/predictions)               │
 * │ Timeout: caller-defined (120s image / 300s video)│
 * │ Retries: 1 (2 total attempts)                    │
 * │ Backoff: 3s (fixed — server needs recovery time) │
 * │ Retries on: network, timeout, server (5xx)       │
 * │ NO retry: auth, validation, quota, cancel        │
 * ├──────────────────────────────────────────────────┤
 * │ POLLING (async result polling)                   │
 * │ Interval: 3s                                     │
 * │ Max attempts: 120 (~6 min)                       │
 * │ Retries on: non-ok responses (skip & continue)   │
 * └──────────────────────────────────────────────────┘
 */

import type { ProviderCapabilities } from "../../domain/types";

export const PRUNA_BASE_URL = 'https://api.pruna.ai';
export const PRUNA_PREDICTIONS_URL = `${PRUNA_BASE_URL}/v1/predictions`;
export const PRUNA_FILES_URL = `${PRUNA_BASE_URL}/v1/files`;

export const DEFAULT_PRUNA_CONFIG = {
  /** Prediction retry — retries the entire prediction call on transient failures */
  maxRetries: 1,
  baseDelay: 1000,
  maxDelay: 10000,

  /** Subscribe defaults */
  defaultTimeoutMs: 360_000,

  /** Polling configuration */
  pollIntervalMs: 3_000,
  maxPollAttempts: 120,

  /** Subscribe retry */
  subscribeMaxRetries: 1,
  subscribeRetryDelayMs: 3_000,
} as const;

export const UPLOAD_CONFIG = {
  /** Timeout per individual upload attempt */
  timeoutMs: 30_000,
  /** Max retries (2 = 3 total attempts) */
  maxRetries: 2,
  /** Initial backoff delay (doubles each retry) */
  baseDelayMs: 1_000,
} as const;

export const PRUNA_CAPABILITIES: ProviderCapabilities = {
  imageFeatures: [] as const,
  videoFeatures: [] as const,
  textToImage: true,
  textToVideo: false,
  imageToVideo: true,
  textToVoice: false,
  textToText: false,
};

/** Valid Pruna model IDs */
export const VALID_PRUNA_MODELS = ['p-video', 'p-image', 'p-image-edit'] as const;

/** Default values for p-video model */
export const P_VIDEO_DEFAULTS = {
  duration: 5,
  resolution: '720p' as const,
  fps: 24,
  draft: false,
  promptUpsampling: true,
} as const;

/** Default aspect ratio for all models */
export const DEFAULT_ASPECT_RATIO = '16:9' as const;
