/**
 * Utils Index
 */

export {
  mapPrunaError,
  isPrunaErrorRetryable,
  getErrorMessage,
  getErrorMessageOr,
  formatErrorMessage,
} from "./pruna-error-handler.util";

export {
  isPrunaModelId,
  isPrunaErrorType,
  isValidApiKey,
  isValidModelId,
  isValidPrompt,
  isValidTimeout,
} from "./type-guards";

export {
  isDefined,
  removeNullish,
  generateUniqueId,
  sleep,
} from "./helpers";

export { generationLogCollector } from "./log-collector";
export type { LogEntry } from "./log-collector";

export { detectMimeType } from "./mime-detection.util";
export {
  MIME_TO_EXTENSION,
  getExtensionForMime,
} from "./constants/mime.constants";
