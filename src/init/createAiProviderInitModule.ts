/**
 * AI Provider Init Module Factory
 * Creates a ready-to-use InitModule for app initialization
 */

import { providerRegistry } from '@umituz/react-native-ai-generation-content';
import { prunaProvider } from '../infrastructure/services';

/**
 * InitModule interface (from @umituz/react-native-design-system)
 */
interface InitModule {
  name: string;
  init: () => Promise<boolean>;
  critical?: boolean;
  dependsOn?: string[];
}

export interface AiProviderInitModuleConfig {
  /**
   * Pruna AI API key getter function
   * Returns the API key or undefined if not available
   */
  getApiKey: () => string | undefined;

  /**
   * Whether this module is critical for app startup
   * @default false
   */
  critical?: boolean;

  /**
   * Module dependencies
   * @default ["firebase"]
   */
  dependsOn?: string[];

  /**
   * Optional callback called after provider is initialized
   */
  onInitialized?: () => void;
}

/**
 * Creates a Pruna AI Provider initialization module for use with createAppInitializer
 */
export function createAiProviderInitModule(
  config: AiProviderInitModuleConfig
): InitModule {
  const {
    getApiKey,
    critical = false,
    dependsOn = ['firebase'],
    onInitialized,
  } = config;

  return {
    name: 'aiProviders',
    critical,
    dependsOn,
    init: () => {
      try {
        const apiKey = getApiKey();

        if (!apiKey) {
          return Promise.resolve(false);
        }

        prunaProvider.initialize({ apiKey });

        if (!providerRegistry.hasProvider(prunaProvider.providerId)) {
          providerRegistry.register(prunaProvider);
        }
        providerRegistry.setActiveProvider(prunaProvider.providerId);

        if (onInitialized) {
          onInitialized();
        }

        return Promise.resolve(true);
      } catch (error) {
        console.error('[AiProviderInitModule] Pruna initialization failed:', error);
        throw error;
      }
    },
  };
}
