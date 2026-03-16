/**
 * Type Guards
 */

import type { PrunaModelId } from "../../domain/entities/pruna.types";
import { PrunaErrorType } from "../../domain/entities/error.types";
import { VALID_PRUNA_MODELS, DEFAULT_PRUNA_CONFIG } from "../services/pruna-provider.constants";

export function isPrunaModelId(value: unknown): value is PrunaModelId {
  if (typeof value !== 'string') return false;
  return VALID_PRUNA_MODELS.includes(value as PrunaModelId);
}

export function isPrunaErrorType(value: unknown): value is PrunaErrorType {
  if (typeof value !== 'string') return false;
  return Object.values(PrunaErrorType).includes(value as PrunaErrorType);
}

export function isValidApiKey(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isValidModelId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 3;
}

export function isValidPrompt(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 5000;
}

export function isValidTimeout(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= DEFAULT_PRUNA_CONFIG.maxTimeoutMs;
}
