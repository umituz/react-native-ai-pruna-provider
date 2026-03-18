/**
 * Generate Video Use Case
 * Handles image-to-video generation using Pruna p-video model
 */

import { ModelId } from "../../domain/value-objects/model-id.value";
import { ValidationService } from "../../domain/services/validation.domain-service";
import { logger } from "../../infrastructure/logging/pruna-logger";
import { fileStorageService } from "../../infrastructure/storage/file-storage";
import { PRUNA_PREDICTIONS_URL, P_VIDEO_DEFAULTS } from "../../infrastructure/services/pruna-provider.constants";
import { httpClient } from "../../infrastructure/api/http-client";

export interface GenerateVideoInput {
  image: string;
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
  fps?: number;
  draft?: boolean;
  promptUpsampling?: boolean;
  audio?: string;
  disableSafetyChecker?: boolean;
}

export interface GenerateVideoOutput {
  videoUrl: string;
  requestId: string;
}

export class GenerateVideoUseCase {
  async execute(
    input: GenerateVideoInput,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<GenerateVideoOutput> {
    const sessionId = logger.createSession();
    const log = logger;

    try {
      // Validate input
      const promptValidation = ValidationService.validatePrompt(input.prompt);
      if (!promptValidation.isValid) {
        throw new Error(promptValidation.error);
      }

      const imageValidation = ValidationService.validateImageData(input.image);
      if (!imageValidation.isValid) {
        throw new Error(imageValidation.error);
      }

      log.info(sessionId, 'generate-video', 'Starting video generation', {
        promptLength: input.prompt.length,
        hasImage: !!input.image,
        hasAudio: !!input.audio,
      });

      // Upload image if needed
      const imageUrl = await fileStorageService.uploadFile(input.image, apiKey, sessionId);

      // Upload audio if provided
      let audioUrl: string | undefined;
      if (input.audio) {
        audioUrl = await fileStorageService.uploadFile(input.audio, apiKey, sessionId);
      }

      // Build payload
      const payload = this.buildPayload(input, imageUrl, audioUrl);
      const modelId = ModelId.create('p-video');

      // Submit prediction
      const response = await httpClient.request<{
        video_url?: string;
        output?: { url?: string } | string;
        get_url?: string;
        status_url?: string;
      }>(
        {
          url: PRUNA_PREDICTIONS_URL,
          method: 'POST',
          headers: {
            apikey: apiKey,
            Model: modelId.toString(),
            'Try-Sync': 'true',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input: payload }),
          signal,
        },
        sessionId,
        'generate-video'
      );

      const videoUrl = this.extractResultUrl(response.data);
      const requestId = `video_${Date.now()}`;

      log.info(sessionId, 'generate-video', 'Generation complete', {
        requestId,
        videoUrl: videoUrl.substring(0, 80) + '...',
      });

      return { videoUrl, requestId };

    } finally {
      logger.endSession(sessionId);
    }
  }

  private buildPayload(
    input: GenerateVideoInput,
    imageUrl: string,
    audioUrl?: string
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      image: imageUrl,
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio || '1:1',
      duration: input.duration ?? P_VIDEO_DEFAULTS.duration,
      resolution: input.resolution ?? P_VIDEO_DEFAULTS.resolution,
      fps: input.fps ?? P_VIDEO_DEFAULTS.fps,
      draft: input.draft ?? P_VIDEO_DEFAULTS.draft,
      prompt_upsampling: input.promptUpsampling ?? P_VIDEO_DEFAULTS.promptUpsampling,
    };

    if (audioUrl) payload.audio = audioUrl;
    if (input.disableSafetyChecker !== undefined) {
      payload.disable_safety_checker = input.disableSafetyChecker;
    }

    return payload;
  }

  private extractResultUrl(data: Record<string, unknown>): string {
    const url = data.video_url ||
                (data.output && typeof data.output === 'object' ? (data.output as { url?: string }).url : null) ||
                (typeof data.output === 'string' ? data.output : null) ||
                data.data;

    if (!url || typeof url !== 'string') {
      throw new Error('No video URL in response');
    }

    return url.startsWith('/') ? `https://api.pruna.ai${url}` : url;
  }
}

export const generateVideoUseCase = new GenerateVideoUseCase();
