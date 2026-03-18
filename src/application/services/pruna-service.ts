/**
 * Pruna Application Service
 * Orchestrates use cases and provides high-level API
 */

import { ApiKey } from "../../domain/value-objects/api-key.value";
import { ModelId } from "../../domain/value-objects/model-id.value";
import { ValidationService } from "../../domain/services/validation.domain-service";
import { logger } from "../../infrastructure/logging/pruna-logger";
import { generateImageUseCase, GenerateImageInput } from "../use-cases/generate-image.use-case";
import { generateVideoUseCase, GenerateVideoInput } from "../use-cases/generate-video.use-case";
import { generateImageEditUseCase, GenerateImageEditInput } from "../use-cases/generate-image-edit.use-case";

export interface PrunaConfig {
  apiKey: string;
  maxTimeoutMs?: number;
}

export type PrunaModel = 'p-image' | 'p-image-edit' | 'p-video';

export class PrunaService {
  private apiKey: ApiKey | null = null;
  private initialized = false;

  initialize(config: PrunaConfig): void {
    const validation = ValidationService.validateApiKey(config.apiKey);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    this.apiKey = ApiKey.create(config.apiKey);
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private ensureInitialized(): ApiKey {
    if (!this.apiKey || !this.initialized) {
      throw new Error("Pruna service not initialized. Call initialize() first.");
    }
    return this.apiKey;
  }

  async generateImage(
    input: GenerateImageInput,
    signal?: AbortSignal
  ): Promise<{ imageUrl: string; requestId: string }> {
    const apiKey = this.ensureInitialized();
    return generateImageUseCase.execute(input, apiKey.toString(), signal);
  }

  async generateVideo(
    input: GenerateVideoInput,
    signal?: AbortSignal
  ): Promise<{ videoUrl: string; requestId: string }> {
    const apiKey = this.ensureInitialized();
    return generateVideoUseCase.execute(input, apiKey.toString(), signal);
  }

  async generateImageEdit(
    input: GenerateImageEditInput,
    signal?: AbortSignal
  ): Promise<{ imageUrl: string; requestId: string }> {
    const apiKey = this.ensureInitialized();
    return generateImageEditUseCase.execute(input, apiKey.toString(), signal);
  }

  reset(): void {
    this.apiKey = null;
    this.initialized = false;
  }

  getSessionLogs(sessionId: string): unknown[] {
    // Return logs for debugging
    return [];
  }
}

export const prunaService = new PrunaService();
