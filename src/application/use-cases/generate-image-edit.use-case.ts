/**
 * Generate Image Edit Use Case
 * Handles image-to-image editing using Pruna p-image-edit model
 */

import { ModelId } from "../../domain/value-objects/model-id.value";
import { ValidationService } from "../../domain/services/validation.domain-service";
import { logger } from "../../infrastructure/logging/pruna-logger";
import { fileStorageService } from "../../infrastructure/storage/file-storage";
import { PRUNA_PREDICTIONS_URL } from "../../infrastructure/services/pruna-provider.constants";
import { httpClient } from "../../infrastructure/api/http-client";

export interface GenerateImageEditInput {
  images?: string[];
  image?: string;
  imageUrl?: string;
  imageUrls?: string[];
  prompt: string;
  aspectRatio?: string;
  seed?: number;
  disableSafetyChecker?: boolean;
  width?: number;
  height?: number;
}

export interface GenerateImageEditOutput {
  imageUrl: string;
  requestId: string;
}

export class GenerateImageEditUseCase {
  async execute(
    input: GenerateImageEditInput,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<GenerateImageEditOutput> {
    const sessionId = logger.createSession();
    const log = logger;

    try {
      // Validate input
      const promptValidation = ValidationService.validatePrompt(input.prompt);
      if (!promptValidation.isValid) {
        throw new Error(promptValidation.error);
      }

      // Extract images
      const rawImages = this.extractImages(input);
      const imageValidation = ValidationService.validateImageData(rawImages);
      if (!imageValidation.isValid) {
        throw new Error(imageValidation.error);
      }

      log.info(sessionId, 'image-edit', 'Starting image edit', {
        imageCount: rawImages.length,
        promptLength: input.prompt.length,
      });

      // Upload images in parallel
      const imageUrls = await Promise.all(
        rawImages.map(img => fileStorageService.uploadFile(img, apiKey, sessionId))
      );

      log.info(sessionId, 'image-edit', 'All images uploaded', {
        count: imageUrls.length,
      });

      // Build payload
      const payload = this.buildPayload(input, imageUrls);
      const modelId = ModelId.create('p-image-edit');

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
        'image-edit'
      );

      const imageUrl = this.extractResultUrl(response.data);
      const requestId = `edit_${Date.now()}`;

      log.info(sessionId, 'image-edit', 'Edit complete', {
        requestId,
        imageUrl: imageUrl.substring(0, 80) + '...',
      });

      return { imageUrl, requestId };

    } finally {
      logger.endSession(sessionId);
    }
  }

  private extractImages(input: GenerateImageEditInput): string[] {
    if (Array.isArray(input.images) && input.images.length > 0) {
      return input.images.filter(img => typeof img === 'string' && img.trim().length > 0);
    }

    if (typeof input.image === 'string' && input.image.trim().length > 0) {
      return [input.image];
    }

    if (typeof input.imageUrl === 'string' && input.imageUrl.trim().length > 0) {
      return [input.imageUrl];
    }

    if (Array.isArray(input.imageUrls) && input.imageUrls.length > 0) {
      return input.imageUrls.filter(url => typeof url === 'string' && url.trim().length > 0);
    }

    throw new Error("No valid images provided. Use 'image', 'images', 'imageUrl', or 'imageUrls'.");
  }

  private buildPayload(
    input: GenerateImageEditInput,
    imageUrls: string[]
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      images: imageUrls,
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

export const generateImageEditUseCase = new GenerateImageEditUseCase();
