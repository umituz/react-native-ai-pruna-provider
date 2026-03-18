/**
 * Pruna DTOs
 * Data transfer objects for Pruna operations
 */

export interface PrunaImageGenerationRequest {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  seed?: number;
  disableSafetyChecker?: boolean;
  width?: number;
  height?: number;
}

export interface PrunaVideoGenerationRequest {
  image: string;
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  duration?: number;
  resolution?: '720p' | '1080p';
  fps?: number;
  draft?: boolean;
  promptUpsampling?: boolean;
  audio?: string;
  disableSafetyChecker?: boolean;
}

export interface PrunaImageEditRequest {
  images?: string[];
  image?: string;
  imageUrl?: string;
  imageUrls?: string[];
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  seed?: number;
  disableSafetyChecker?: boolean;
  width?: number;
  height?: number;
}

export interface PrunaGenerationResponse {
  url: string;
  requestId: string;
  sessionId?: string;
}

export interface PrunaGenerationOptions {
  timeout?: number;
  onProgress?: (progress: number, status: string) => void;
  onQueueUpdate?: (update: { status: string; requestId: string }) => void;
}

export interface PrunaGenerationError {
  type: string;
  message: string;
  retryable: boolean;
  originalError?: string;
}
