/**
 * Validation Domain Service
 * Centralized validation logic for Pruna operations
 */

import { ApiKey } from "../value-objects/api-key.value";
import { ModelId } from "../value-objects/model-id.value";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class ValidationService {
  static validatePrompt(prompt: unknown): ValidationResult {
    if (!prompt || typeof prompt !== 'string') {
      return { isValid: false, error: "Prompt is required and must be a string" };
    }
    if (prompt.trim().length === 0) {
      return { isValid: false, error: "Prompt cannot be empty" };
    }
    if (prompt.length > 2000) {
      return { isValid: false, error: "Prompt exceeds maximum length of 2000 characters" };
    }
    return { isValid: true };
  }

  static validateApiKey(apiKey: string | ApiKey): ValidationResult {
    try {
      if (apiKey instanceof ApiKey) {
        return { isValid: true };
      }
      ApiKey.create(apiKey);
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Invalid API key"
      };
    }
  }

  static validateModel(model: string): ValidationResult {
    try {
      ModelId.create(model);
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Invalid model"
      };
    }
  }

  static validateTimeout(timeoutMs: number, maxTimeoutMs: number): ValidationResult {
    if (!Number.isInteger(timeoutMs)) {
      return { isValid: false, error: "Timeout must be an integer" };
    }
    if (timeoutMs <= 0) {
      return { isValid: false, error: "Timeout must be positive" };
    }
    if (timeoutMs > maxTimeoutMs) {
      return { isValid: false, error: `Timeout cannot exceed ${maxTimeoutMs}ms` };
    }
    return { isValid: true };
  }

  static validateImageData(imageData: unknown): ValidationResult {
    if (!imageData) {
      return { isValid: false, error: "Image data is required" };
    }

    if (typeof imageData === 'string') {
      if (imageData.trim().length === 0) {
        return { isValid: false, error: "Image data cannot be empty" };
      }
      return { isValid: true };
    }

    if (Array.isArray(imageData)) {
      if (imageData.length === 0) {
        return { isValid: false, error: "Image array cannot be empty" };
      }
      const hasInvalidItem = imageData.some(item => typeof item !== 'string' || item.trim().length === 0);
      if (hasInvalidItem) {
        return { isValid: false, error: "Image array contains invalid items" };
      }
      return { isValid: true };
    }

    return { isValid: false, error: "Image data must be a string or array of strings" };
  }
}
