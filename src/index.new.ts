/**
 * Pruna AI Provider - Refactored with DDD Architecture
 *
 * @module react-native-ai-pruna-provider
 *
 * Architecture:
 * - Domain: Business logic, value objects, domain services
 * - Application: Use cases, orchestration, DTOs
 * - Infrastructure: API clients, storage, logging
 * - Presentation: React hooks, UI integration
 *
 * Key Features:
 * - Clean separation of concerns
 * - Maximum 150 lines per file
 * - No code duplication
 * - Type-safe with TypeScript
 * - Comprehensive error handling
 */

// Core Service
export { prunaService, PrunaService } from './application/services/pruna-service';
export type {
  PrunaConfig,
  PrunaModel,
} from './application/services/pruna-service';

// React Hooks
export { usePrunaGeneration } from './presentation/hooks/use-pruna-generation.new';
export type { PrunaGenerationState } from './presentation/hooks/use-pruna-generation.new';

// DTOs
export type {
  PrunaImageGenerationRequest,
  PrunaVideoGenerationRequest,
  PrunaImageEditRequest,
  PrunaGenerationResponse,
  PrunaGenerationOptions,
  PrunaGenerationError,
} from './application/dto/pruna.dto';

// Domain Layer
export { SessionId } from './domain/value-objects/session-id.value';
export { ApiKey } from './domain/value-objects/api-key.value';
export { ModelId, PrunaModelId } from './domain/value-objects/model-id.value';
export { ValidationService, ValidationResult } from './domain/services/validation.domain-service';
export { ErrorMapperService } from './domain/services/error-mapper.domain-service';

// Infrastructure Layer
export { logger, createLogger, LogLevel } from './infrastructure/logging/pruna-logger';
export { httpClient, HttpClient } from './infrastructure/api/http-client';
export { fileStorageService, FileStorageService } from './infrastructure/storage/file-storage';

// Use Cases (for advanced usage)
export { generateImageUseCase, GenerateImageUseCase } from './application/use-cases/generate-image.use-case';
export { generateVideoUseCase, GenerateVideoUseCase } from './application/use-cases/generate-video.use-case';
export { generateImageEditUseCase, GenerateImageEditUseCase } from './application/use-cases/generate-image-edit.use-case';

// Legacy Exports (for backward compatibility)
export { prunaProvider as PrunaProvider } from './infrastructure/services/pruna-provider';
export type {
  IAIProvider,
  AIProviderConfig,
  SubscribeOptions,
  RunOptions,
} from './domain/types';
