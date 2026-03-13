/**
 * @umituz/react-native-ai-pruna-provider
 * Pruna AI provider for React Native - implements IAIProvider interface
 *
 * Supported models:
 *   p-image:      text-to-image
 *   p-image-edit: image-to-image
 *   p-video:      image-to-video
 */

// Domain Types
export type {
  PrunaConfig,
  PrunaModel,
  PrunaModelId,
  PrunaModelType,
  PrunaModelPricing,
  PrunaAspectRatio,
  PrunaResolution,
  PrunaJobInput,
  PrunaJobStatusType,
  PrunaQueueStatus,
  PrunaPredictionInput,
  PrunaPredictionResponse,
  PrunaFileUploadResponse,
} from "./domain/entities/pruna.types";

export { PrunaErrorType } from "./domain/entities/error.types";
export type { PrunaErrorInfo } from "./domain/entities/error.types";

export type {
  ImageFeatureType,
  VideoFeatureType,
  AIProviderConfig,
  AIJobStatusType,
  AILogEntry,
  JobSubmission,
  JobStatus,
  ProviderProgressInfo,
  SubscribeOptions,
  RunOptions,
  ProviderCapabilities,
  ImageFeatureInputData,
  VideoFeatureInputData,
  IAIProvider,
} from "./domain/types";

// Infrastructure Services
export { PrunaProvider, prunaProvider } from "./infrastructure/services/pruna-provider";
export type { PrunaProvider as PrunaProviderType } from "./infrastructure/services/pruna-provider";

export {
  cleanupRequestStore,
  stopAutomaticCleanup,
} from "./infrastructure/services/request-store";
export type { ActiveRequest } from "./infrastructure/services/request-store";

export {
  PRUNA_BASE_URL,
  PRUNA_PREDICTIONS_URL,
  PRUNA_FILES_URL,
  DEFAULT_PRUNA_CONFIG,
  UPLOAD_CONFIG,
  PRUNA_CAPABILITIES,
  VALID_PRUNA_MODELS,
  P_VIDEO_DEFAULTS,
  DEFAULT_ASPECT_RATIO,
  P_VIDEO_PRICING,
  DRAFT_MODE_CONFIG,
} from "./infrastructure/services/pruna-provider.constants";

// Infrastructure Utils
export {
  mapPrunaError,
  isPrunaErrorRetryable,
  getErrorMessage,
  getErrorMessageOr,
  formatErrorMessage,
} from "./infrastructure/utils/pruna-error-handler.util";

export {
  isPrunaModelId,
  isPrunaErrorType,
  isValidApiKey,
  isValidModelId,
  isValidPrompt,
  isValidTimeout,
} from "./infrastructure/utils/type-guards";

export { isDefined } from "./infrastructure/utils/helpers";

export { generationLogCollector } from "./infrastructure/utils/log-collector";
export type { LogEntry } from "./infrastructure/utils/log-collector";

export { detectMimeType } from "./infrastructure/utils/mime-detection.util";

export {
  MIME_IMAGE_PNG,
  MIME_IMAGE_JPEG,
  MIME_IMAGE_WEBP,
  MIME_AUDIO_MPEG,
  MIME_AUDIO_WAV,
  MIME_AUDIO_FLAC,
  MIME_AUDIO_MP4,
  MIME_APPLICATION_OCTET,
  MIME_DEFAULT,
  MIME_TO_EXTENSION,
  getExtensionForMime,
} from "./infrastructure/utils/constants/mime.constants";

export {
  validateDraftModeParams,
  calculateDraftModeDiscount,
  getDraftModeDescription,
  recommendDraftMode,
  calculateDraftModeSavings,
  getPricingPerSecond,
  formatPriceUSD,
  compareDraftModePricing,
} from "./infrastructure/utils/pruna-draft-mode.util";

export { PrunaGenerationStateManager } from "./infrastructure/utils/pruna-generation-state-manager.util";
export type {
  GenerationState,
  GenerationStateOptions,
} from "./infrastructure/utils/pruna-generation-state-manager.util";

// Presentation Hooks
export { usePrunaGeneration } from "./presentation/hooks/use-pruna-generation";
export type {
  UsePrunaGenerationOptions,
  UsePrunaGenerationResult,
} from "./presentation/hooks/use-pruna-generation";

// Init Modules
export { initializePrunaProvider } from "./init/initializePrunaProvider";
export { createAiProviderInitModule } from "./init/createAiProviderInitModule";
export type { AiProviderInitModuleConfig } from "./init/createAiProviderInitModule";
