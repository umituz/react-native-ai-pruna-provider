/**
 * Generate Image Use Case
 * Handles text-to-image generation using Pruna p-image model
 */

import { ModelId } from "../../domain/value-objects/model-id.value";
import { ValidationService } from "../../domain/services/validation.domain-service";
import { logger } from "../../infrastructure/logging/pruna-logger";
import { PRUNA_PREDICTIONS_URL } from "../../infrastructure/services/pruna-provider.constants";
import { httpClient } from "../../infrastructure/api/http-client";

export interface GenerateImageInput {
  prompt: string;
  aspectRatio?: string;
  seed?: number;
  disableSafetyChecker?: boolean;
  width?: number;
  height?: number;
}

export interface GenerateImageOutput {
  imageUrl: string;
  requestId: string;
}

export class GenerateImageUseCase {
  async execute(
    input: GenerateImageInput,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<GenerateImageOutput> {
    // Create session for logging
    const sessionId = logger.createSession();
    const log = logger;

    try {
      // Validate input
      const promptValidation = ValidationService.validatePrompt(input.prompt);
      if (!promptValidation.isValid) {
        log.error(sessionId, 'generate-image', 'Validation failed', {
          error: promptValidation.error,
        });
        throw new Error(promptValidation.error);
      }

      // Build request payload
      const payload = this.buildPayload(input);
      const modelId = ModelId.create('p-image');

      log.info(sessionId, 'generate-image', 'Starting image generation', {
        promptLength: input.prompt.length,
        aspectRatio: input.aspectRatio,
      });

      // Submit prediction
      const response = await httpClient.request<{
        generation_url?: string;
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
        'generate-image'
      );

      // Extract result URL
      const imageUrl = this.extractResultUrl(response.data);
      const requestId = `img_${Date.now()}`;

      log.info(sessionId, 'generate-image', 'Generation complete', {
        requestId,
        imageUrl: imageUrl.substring(0, 80) + '...',
      });

      return { imageUrl, requestId };

    } finally {
      logger.endSession(sessionId);
    }
  }

  private buildPayload(input: GenerateImageInput): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio || '1:1',
    };

    // Add optional parameters
    if (input.seed !== undefined) payload.seed = input.seed;
    if (input.disableSafetyChecker !== undefined) {
      payload.disable_safety_checker = input.disableSafetyChecker;
    }
    if (input.width !== undefined) payload.width = input.width;
    if (input.height !== undefined) payload.height = input.height;

    return payload;
  }

  private extractResultUrl(data: Record<string, unknown>): string {
    const url = data.generation_url ||
                (data.output && typeof data.output === 'object' ? (data.output as { url?: string }).url : null) ||
                (typeof data.output === 'string' ? data.output : null) ||
                data.data;

    if (!url || typeof url !== 'string') {
      throw new Error('No image URL in response');
    }

    return url.startsWith('/') ? `https://api.pruna.ai${url}` : url;
  }
}

export const generateImageUseCase = new GenerateImageUseCase();
