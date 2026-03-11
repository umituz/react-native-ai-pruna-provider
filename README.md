# @umituz/react-native-ai-pruna-provider

Pruna AI provider for React Native - implements `IAIProvider` interface for unified AI generation.

## Supported Models

- **p-image**: Text-to-image generation ($0.005/run)
- **p-image-edit**: Image-to-image editing ($0.010/run)
- **p-video**: Image-to-video generation with draft mode support

## Installation

```bash
npm install @umituz/react-native-ai-pruna-provider
```

## Quick Start

```typescript
import { initializePrunaProvider } from '@umituz/react-native-ai-pruna-provider';

// Initialize at app startup
initializePrunaProvider({
  apiKey: process.env.PRUNA_API_KEY,
  setAsActive: true,
});
```

## Usage

### Text-to-Image (p-image)

```typescript
import { prunaProvider } from '@umituz/react-native-ai-pruna-provider';

const result = await prunaProvider.subscribe('p-image', {
  prompt: 'A sunset over the ocean',
  aspect_ratio: '16:9',
});
console.log(result.url);
```

### Image Editing (p-image-edit)

```typescript
const result = await prunaProvider.subscribe('p-image-edit', {
  images: ['data:image/jpeg;base64,...'],
  prompt: 'Make it look like a painting',
  aspect_ratio: '1:1',
});
```

### Image-to-Video (p-video)

```typescript
const result = await prunaProvider.subscribe('p-video', {
  image: 'data:image/jpeg;base64,...',
  prompt: 'The camera pans slowly from left to right',
  duration: 10,
  resolution: '1080p',
  fps: 24,
  draft: true, // Enable draft mode
});
```

## Draft Mode (p-video)

Draft mode is a faster, more cost-effective way to generate videos for testing and iteration.

### What is Draft Mode?

- **50% cheaper** than normal mode
- **4x faster** generation time
- **Lower quality** output (suitable for previews)
- **Same resolution** options (720p, 1080p)

### Pricing

| Resolution | Normal Mode | Draft Mode | Savings |
|------------|-------------|------------|---------|
| 720p       | $0.05/sec   | $0.025/sec | 50%     |
| 1080p      | $0.08/sec   | $0.04/sec  | 50%     |

### When to Use Draft Mode

✅ **Recommended for:**
- Testing prompts and concepts
- Iterating on video generation
- Previewing before final generation
- Longer videos (8+ seconds)
- High resolution (1080p)

❌ **Not recommended for:**
- Final production videos
- Social media sharing
- Client deliverables

### Draft Mode Example

```typescript
// Test with draft mode (fast & cheap)
const draftResult = await prunaProvider.subscribe('p-video', {
  image: base64Image,
  prompt: 'Person walking on beach',
  duration: 10,
  resolution: '1080p',
  draft: true, // Enable draft mode
});
// Cost: 10 × $0.04 = $0.40

// Generate final version with normal mode
const finalResult = await prunaProvider.subscribe('p-video', {
  image: base64Image,
  prompt: 'Person walking on beach',
  duration: 10,
  resolution: '1080p',
  draft: false, // Normal mode (default)
});
// Cost: 10 × $0.08 = $0.80
```

## API Reference

### PrunaProvider

Implements `IAIProvider` interface.

#### Methods

- `initialize(config: AIProviderConfig): void` - Initialize provider with API key
- `isInitialized(): boolean` - Check if provider is initialized
- `getCapabilities(): ProviderCapabilities` - Get provider capabilities
- `subscribe<T>(model, input, options?): Promise<T>` - Subscribe to generation result
- `run<T>(model, input, options?): Promise<T>` - Run generation once
- `submitJob(model, input): Promise<JobSubmission>` - Submit async job
- `getJobStatus(model, requestId): Promise<JobStatus>` - Get job status
- `getJobResult<T>(model, requestId): Promise<T>` - Get job result
- `reset(): void` - Reset provider state
- `cancelCurrentRequest(): void` - Cancel current request
- `hasRunningRequest(): boolean` - Check if request is running
- `getSessionLogs(sessionId): LogEntry[]` - Get session logs
- `endLogSession(sessionId): LogEntry[]` - End log session

### usePrunaGeneration Hook

React hook for Pruna AI generation operations.

```typescript
import { usePrunaGeneration } from '@umituz/react-native-ai-pruna-provider';

const {
  data,
  error,
  isLoading,
  isRetryable,
  requestId,
  generate,
  retry,
  cancel,
  reset,
} = usePrunaGeneration<{
  url: string;
  generation_url: string;
}>({
  timeoutMs: 120000,
  onProgress: (status) => console.log(status),
  onError: (error) => console.error(error),
});

// Generate video
await generate('p-video', {
  image: base64Image,
  prompt: 'Camera pans from left to right',
  duration: 10,
  resolution: '1080p',
  draft: true,
});
```

## Type Exports

```typescript
// Core types
export type { PrunaModelId, PrunaResolution, PrunaAspectRatio };
export type { PrunaPredictionInput, PrunaPredictionResponse };
export type { PrunaConfig, PrunaErrorType, PrunaErrorInfo };

// Draft mode utilities
export {
  validateDraftModeParams,
  calculateDraftModeDiscount,
  getDraftModeDescription,
  recommendDraftMode,
  calculateDraftModeSavings,
  getPricingPerSecond,
  formatPriceUSD,
  compareDraftModePricing,
};

// Constants
export {
  P_VIDEO_PRICING,
  DRAFT_MODE_CONFIG,
  P_VIDEO_DEFAULTS,
  PRUNA_CAPABILITIES,
};
```

## Error Handling

The provider provides typed error information:

```typescript
try {
  await prunaProvider.subscribe('p-video', input);
} catch (error) {
  if (error.retryable) {
    // Retry the request
  } else {
    // Handle error
    console.error(error.message);
  }
}
```

### Error Types

- `AUTHENTICATION` - Invalid API key
- `RATE_LIMIT` - Too many requests
- `NETWORK` - Network error
- `TIMEOUT` - Request timeout
- `VALIDATION` - Invalid input parameters
- `QUOTA` - Credit/quota exceeded
- `SERVER` - Server error (5xx)
- `UNKNOWN` - Unknown error

## Initialization

### Direct Initialization

```typescript
import { initializePrunaProvider } from '@umituz/react-native-ai-pruna-provider';

export const configureAIServices = (): void => {
  initializePrunaProvider({
    apiKey: getPrunaApiKey(),
    setAsActive: true,
  });
};
```

### Init Module Factory

```typescript
import { createAiProviderInitModule } from '@umituz/react-native-ai-pruna-provider';

const prunaInitModule = createAiProviderInitModule({
  apiKey: getPrunaApiKey(),
  setAsActive: true,
});

// Register with app initialization
appRegistry.registerModule('pruna-ai', prunaInitModule);
```

## Best Practices

1. **Use Draft Mode for Testing**: Always test prompts with draft mode before generating final videos
2. **Handle Errors Gracefully**: Check `error.retryable` before retrying requests
3. **Monitor Progress**: Use `onProgress` callback to track generation status
4. **Clean Up Resources**: Call `reset()` when done to clean up request store
5. **Set Timeouts**: Use appropriate timeout values (120s for images, 300s for videos)

## Example: Complete Workflow

```typescript
import { prunaProvider, usePrunaGeneration } from '@umituz/react-native-ai-pruna-provider';

function VideoGenerator() {
  const { generate, data, isLoading, error } = usePrunaGeneration<{ url: string }>();

  const handleGenerate = async () => {
    // Step 1: Test with draft mode
    const draftResult = await generate('p-video', {
      image: base64Image,
      prompt: 'Person walking on beach',
      duration: 10,
      resolution: '1080p',
      draft: true,
    });

    if (draftResult) {
      console.log('Draft preview:', draftResult.url);
    }

    // Step 2: Generate final version
    const finalResult = await generate('p-video', {
      image: base64Image,
      prompt: 'Person walking on beach',
      duration: 10,
      resolution: '1080p',
      draft: false,
    });

    console.log('Final video:', finalResult.url);
  };

  return (
    <View>
      <Button onPress={handleGenerate} disabled={isLoading}>
        Generate Video
      </Button>
      {error && <Text>Error: {error.message}</Text>}
      {data && <Video source={{ uri: data.url }} />}
    </View>
  );
}
```

## License

MIT

## Author

Umit UZ <umit@umituz.com>

## Repository

https://github.com/umituz/react-native-ai-pruna-provider

## See Also

- [@umituz/react-native-ai-generation-content](https://github.com/umituz/react-native-ai-generation-content) - Unified AI generation framework
- [Pruna AI Documentation](https://docs.pruna.ai/) - Official Pruna AI docs
