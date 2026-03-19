/**
 * Direct Pruna Provider Initialization
 * Synchronous initialization for simple app startup
 */

import { providerRegistry } from '@umituz/react-native-ai-generation-content';
import { prunaProvider } from '../infrastructure/services/pruna-provider';
import { logger } from '../infrastructure/logging/pruna-logger';

/**
 * Initializes Pruna provider and registers it with providerRegistry in one call.
 * Use this for simple synchronous registration at app startup.
 */
export function initializePrunaProvider(config: {
  apiKey: string | undefined;
  /** When true (default), sets this provider as the active/default provider */
  setAsActive?: boolean;
}): boolean {
  try {
    const { apiKey, setAsActive = true } = config;

    if (!apiKey) {
      return false;
    }

    prunaProvider.initialize({ apiKey });

    if (!providerRegistry.hasProvider(prunaProvider.providerId)) {
      providerRegistry.register(prunaProvider);
    }
    if (setAsActive) {
      providerRegistry.setActiveProvider(prunaProvider.providerId);
    }

    return true;
  } catch (error) {
    logger.error('app-init', 'pruna-provider', 'Initialization failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
