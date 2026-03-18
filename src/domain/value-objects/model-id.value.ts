/**
 * ModelId Value Object
 * Represents a valid Pruna model identifier
 */

import { VALID_PRUNA_MODELS } from "../../infrastructure/services/pruna-provider.constants";

export type PrunaModelId = 'p-image' | 'p-image-edit' | 'p-video';

export class ModelId {
  private readonly value: PrunaModelId;

  private constructor(value: PrunaModelId) {
    this.value = value;
  }

  static create(value: string): ModelId {
    if (!VALID_PRUNA_MODELS.includes(value as PrunaModelId)) {
      throw new Error(
        `Invalid model: "${value}". Valid models: ${VALID_PRUNA_MODELS.join(', ')}`
      );
    }
    return new ModelId(value as PrunaModelId);
  }

  toString(): string {
    return this.value;
  }

  isImage(): boolean {
    return this.value === 'p-image';
  }

  isImageEdit(): boolean {
    return this.value === 'p-image-edit';
  }

  isVideo(): boolean {
    return this.value === 'p-video';
  }
}
