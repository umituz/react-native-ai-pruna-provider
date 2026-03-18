# Pruna AI Provider - Usage Examples

## Quick Start

### Installation
```bash
npm install @umituz/react-native-ai-pruna-provider
```

### Basic Setup
```typescript
import { prunaService } from '@umituz/react-native-ai-pruna-provider';

// Initialize once at app startup
prunaService.initialize({
  apiKey: 'your-pruna-api-key',
});
```

## Image Generation

### Text to Image
```typescript
import { prunaService } from '@umituz/react-native-ai-pruna-provider';

const result = await prunaService.generateImage({
  prompt: 'A beautiful sunset over mountains',
  aspectRatio: '16:9',
  seed: 42, // Optional
});

console.log(result.imageUrl); // https://...
console.log(result.requestId); // img_1234567890
```

### Using React Hook
```typescript
import { usePrunaGeneration } from '@umituz/react-native-ai-pruna-provider';

function ImageGenerator() {
  const { generateImage, state, cancel } = usePrunaGeneration();

  const handleGenerate = async () => {
    try {
      const result = await generateImage({
        prompt: 'A futuristic cityscape',
        aspectRatio: '16:9',
      });
      console.log('Image generated:', result.imageUrl);
    } catch (error) {
      console.error('Generation failed:', error);
    }
  };

  return (
    <View>
      <Button
        title="Generate"
        onPress={handleGenerate}
        disabled={state.isGenerating}
      />
      {state.isGenerating && (
        <Text>Generating... {state.progress}%</Text>
      )}
      {state.result && (
        <Image source={{ uri: state.result.url }} />
      )}
      {state.error && (
        <Text>Error: {state.error.message}</Text>
      )}
    </View>
  );
}
```

## Video Generation

### Image to Video
```typescript
import { prunaService } from '@umituz/react-native-ai-pruna-provider';

const result = await prunaService.generateVideo({
  image: 'base64-image-data-or-url',
  prompt: 'Make the clouds move slowly',
  aspectRatio: '16:9',
  duration: 4, // seconds
  resolution: '1080p',
  fps: 24,
});

console.log(result.videoUrl); // https://...
```

### With Audio
```typescript
const result = await prunaService.generateVideo({
  image: 'image-data',
  prompt: 'Add dramatic movement',
  audio: 'base64-audio-data-or-url', // Optional
  duration: 5,
  resolution: '1080p',
});
```

## Image Editing

### Image to Image
```typescript
import { prunaService } from '@umituz/react-native-ai-pruna-provider';

const result = await prunaService.generateImageEdit({
  images: ['base64-image-1', 'base64-image-2'],
  prompt: 'Transform into a watercolor painting',
  aspectRatio: '1:1',
  seed: 123,
});

console.log(result.imageUrl);
```

### Single Image Edit
```typescript
const result = await prunaService.generateImageEdit({
  image: 'base64-image-data',
  prompt: 'Add neon lights',
  aspectRatio: '16:9',
});
```

### Using URLs
```typescript
const result = await prunaService.generateImageEdit({
  imageUrl: 'https://example.com/image.jpg',
  prompt: 'Apply anime style',
});
```

## Advanced Usage

### With Abort Signal
```typescript
const controller = new AbortController();

// Start generation
const promise = prunaService.generateImage({
  prompt: 'A complex scene',
}, controller.signal);

// Cancel if needed
setTimeout(() => {
  controller.abort();
}, 5000); // Cancel after 5 seconds

try {
  const result = await promise;
} catch (error) {
  if (error.message.includes('cancelled')) {
    console.log('Generation was cancelled');
  }
}
```

### Error Handling
```typescript
try {
  const result = await prunaService.generateImage({
    prompt: 'Test',
  });
} catch (error) {
  if (error.message.includes('validation')) {
    // Handle validation errors
    console.error('Invalid input');
  } else if (error.message.includes('quota')) {
    // Handle quota errors
    console.error('API quota exceeded');
  } else if (error.message.includes('network')) {
    // Handle network errors
    console.error('Network error - will retry');
  }
}
```

### Using Direct Use Cases
```typescript
import { generateImageUseCase } from '@umituz/react-native-ai-pruna-provider';

// Use use case directly for more control
const result = await generateImageUseCase.execute(
  {
    prompt: 'A mountain landscape',
    aspectRatio: '16:9',
  },
  'your-api-key',
  abortSignal // optional
);
```

## Value Objects

### Working with Value Objects
```typescript
import {
  ApiKey,
  ModelId,
  SessionId
} from '@umituz/react-native-ai-pruna-provider';

// Create API key with validation
const apiKey = ApiKey.create('your-api-key');
console.log(apiKey.mask()); // ****-****-****-key

// Validate model ID
const modelId = ModelId.create('p-image');
console.log(modelId.isImage()); // true
console.log(modelId.isVideo()); // false

// Create session ID for logging
const sessionId = new SessionId();
console.log(sessionId.toString()); // session_1_1234567890
```

### Validation Service
```typescript
import { ValidationService } from '@umituz/react-native-ai-pruna-provider';

// Validate prompt
const promptValidation = ValidationService.validatePrompt('A scene');
if (!promptValidation.isValid) {
  console.error(promptValidation.error);
}

// Validate image data
const imageValidation = ValidationService.validateImageData(imageData);
if (!imageValidation.isValid) {
  console.error(imageValidation.error);
}

// Validate timeout
const timeoutValidation = ValidationService.validateTimeout(30000, 3600000);
if (!timeoutValidation.isValid) {
  console.error(timeoutValidation.error);
}
```

### Error Mapper
```typescript
import { ErrorMapperService } from '@umituz/react-native-ai-pruna-provider';

try {
  // Some operation
} catch (error) {
  const mappedError = ErrorMapperService.mapError(error);

  console.log('Error type:', mappedError.type);
  console.log('Error message:', mappedError.messageKey);
  console.log('Is retryable:', mappedError.retryable);

  if (mappedError.retryable) {
    // Retry the operation
  }
}
```

## Logging

### Using Logger
```typescript
import { logger } from '@umituz/react-native-ai-pruna-provider';

// Create session
const sessionId = logger.createSession();

// Log messages
logger.info(sessionId, 'my-tag', 'Operation started', { data: 'value' });
logger.warn(sessionId, 'my-tag', 'Warning message');
logger.error(sessionId, 'my-tag', 'Error occurred', { error: 'details' });

// End session (cleanup)
logger.endSession(sessionId);
```

### Using Logger Factory
```typescript
import { createLogger } from '@umituz/react-native-ai-pruna-provider';

const log = createLogger('my-component');

const sessionId = logger.createSession();
log.info(sessionId, 'Component mounted');
log.warn(sessionId, 'Deprecated API used');
log.error(sessionId, 'Operation failed', { code: 500 });
```

## Complete Example

```typescript
import React, { useState } from 'react';
import { View, Button, Image, Text, ActivityIndicator } from 'react-native';
import { usePrunaGeneration } from '@umituz/react-native-ai-pruna-provider';

function App() {
  const { generateImage, state, cancel, reset } = usePrunaGeneration();
  const [prompt, setPrompt] = useState('A beautiful landscape');

  const handleGenerate = async () => {
    try {
      reset(); // Clear previous state
      const result = await generateImage({
        prompt,
        aspectRatio: '16:9',
      });
      console.log('Success:', result);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Prompt:</Text>
      <Text>{prompt}</Text>

      <Button
        title={state.isGenerating ? "Generating..." : "Generate"}
        onPress={handleGenerate}
        disabled={state.isGenerating}
      />

      {state.isGenerating && (
        <>
          <ActivityIndicator />
          <Text>Progress: {state.progress}%</Text>
          <Text>Status: {state.status}</Text>
          <Button title="Cancel" onPress={cancel} />
        </>
      )}

      {state.result && (
        <>
          <Text>Generated:</Text>
          <Image
            source={{ uri: state.result.url }}
            style={{ width: 300, height: 300 }}
            resizeMode="contain"
          />
        </>
      )}

      {state.error && (
        <Text style={{ color: 'red' }}>
          Error: {state.error.message}
        </Text>
      )}
    </View>
  );
}

export default App;
```

## TypeScript Support

All APIs are fully typed:

```typescript
import type {
  PrunaImageGenerationRequest,
  PrunaVideoGenerationRequest,
  PrunaImageEditRequest,
  PrunaGenerationResponse,
  PrunaGenerationError,
} from '@umituz/react-native-ai-pruna-provider';

const imageRequest: PrunaImageGenerationRequest = {
  prompt: 'A sunset',
  aspectRatio: '16:9',
  seed: 42,
};

const handleResult = (result: PrunaGenerationResponse) => {
  console.log(result.url); // Fully typed
};

const handleError = (error: PrunaGenerationError) => {
  console.log(error.type); // Fully typed
  console.log(error.retryable); // Fully typed
};
```

## Best Practices

1. **Initialize Once**: Call `prunaService.initialize()` at app startup
2. **Use Hooks**: Prefer `usePrunaGeneration` for React components
3. **Handle Errors**: Always wrap calls in try-catch
4. **Cancel When Needed**: Use AbortSignal for long operations
5. **Clean Up**: End logger sessions when done
6. **Validate Input**: Use ValidationService before API calls
7. **Type Safety**: Leverage TypeScript types for better DX

## Troubleshooting

### Common Issues

**Issue**: "Pruna service not initialized"
```typescript
// Solution: Initialize first
prunaService.initialize({ apiKey: 'your-key' });
```

**Issue**: "Invalid API key"
```typescript
// Solution: Validate API key
const validation = ValidationService.validateApiKey(apiKey);
if (!validation.isValid) {
  console.error(validation.error);
}
```

**Issue**: "Prompt validation failed"
```typescript
// Solution: Check prompt length and content
const validation = ValidationService.validatePrompt(prompt);
console.log(validation.error); // See what's wrong
```

**Issue**: Generation timeout
```typescript
// Solution: Cancel long-running requests
const controller = new AbortController();
setTimeout(() => controller.abort(), 30000); // 30s timeout
```
