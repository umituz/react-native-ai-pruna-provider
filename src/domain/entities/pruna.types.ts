/**
 * Pruna AI Types
 * Core type definitions for Pruna AI integration
 *
 * Models (from docs.pruna.ai):
 *   p-video:      image-to-video — requires image (file URL), prompt, duration, resolution, fps, draft, aspect_ratio
 *   p-image:      text-to-image  — requires prompt; optional aspect_ratio, seed
 *   p-image-edit: image-to-image — requires images[] (base64 or URL), prompt; optional aspect_ratio, seed
 */

export interface PrunaConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly maxRetries?: number;
  readonly baseDelay?: number;
  readonly maxDelay?: number;
  readonly defaultTimeoutMs?: number;
}

export type PrunaModelId = 'p-video' | 'p-image' | 'p-image-edit';

export type PrunaModelType =
  | "text-to-image"
  | "image-to-video"
  | "image-to-image";

export type PrunaAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '3:2' | '2:3';

export type PrunaResolution = '720p' | '1080p';

export interface PrunaModel {
  readonly id: PrunaModelId;
  readonly name: string;
  readonly description?: string;
  readonly type: PrunaModelType;
  readonly pricing?: PrunaModelPricing;
  readonly enabled: boolean;
}

export interface PrunaModelPricing {
  readonly baseCost: number;
  readonly perSecondCost?: number;
  readonly resolutionMultiplier?: Record<PrunaResolution, number>;
}

export interface PrunaJobInput {
  readonly [key: string]: unknown;
}

export interface PrunaJobResult<T = unknown> {
  readonly requestId: string;
  readonly data: T;
}

export interface PrunaLogEntry {
  readonly message: string;
  readonly timestamp?: string;
  readonly level?: "info" | "warn" | "error";
}

export type PrunaJobStatusType = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface PrunaQueueStatus {
  readonly status: PrunaJobStatusType;
  readonly requestId: string;
  readonly logs?: readonly PrunaLogEntry[];
}

export interface PrunaSubscribeOptions {
  readonly onQueueUpdate?: (update: PrunaQueueStatus) => void;
  readonly timeoutMs?: number;
}

/**
 * Pruna API prediction request input
 */
export interface PrunaPredictionInput {
  readonly prompt: string;
  readonly aspect_ratio?: PrunaAspectRatio;
  readonly image?: string;
  readonly images?: readonly string[];
  readonly reference_image?: string;
  /** Audio file for p-video (base64 or URL). When provided, duration is determined by audio length. */
  readonly audio?: string;
  readonly duration?: number;
  readonly resolution?: PrunaResolution;
  readonly fps?: number;
  readonly draft?: boolean;
  readonly prompt_upsampling?: boolean;
  readonly seed?: number;
  readonly disable_safety_checker?: boolean;
  readonly width?: number;
  readonly height?: number;
}

/**
 * Pruna API prediction response (raw)
 */
export interface PrunaPredictionResponse {
  readonly generation_url?: string;
  readonly output?: { readonly url: string } | string | readonly string[];
  readonly data?: string;
  readonly video_url?: string;
  readonly get_url?: string;
  readonly status_url?: string;
  readonly status?: 'succeeded' | 'completed' | 'failed';
  readonly error?: string;
}

/**
 * Pruna API file upload response
 */
export interface PrunaFileUploadResponse {
  readonly id?: string;
  readonly urls?: {
    readonly get: string;
  };
}
