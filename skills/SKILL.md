---
name: setup-react-native-ai-pruna-provider
description: Sets up Pruna AI provider for React Native apps with automated installation and configuration. Triggers on: Setup Pruna AI, install Pruna provider, Pruna API, text-to-image, image-to-video, AI generation, usePrunaGeneration, Stable Diffusion, image upscaling.
---

# Setup React Native AI - Pruna Provider

Comprehensive setup for `@umituz/react-native-ai-pruna-provider` - Pruna AI integration for image and video generation.

## Overview

This skill handles everything needed to integrate Pruna AI into your React Native or Expo app:
- Package installation and updates
- API key configuration
- Provider setup and initialization
- Text-to-image generation
- Image-to-video generation
- Image upscaling
- Multiple model support

## Quick Start

Just say: **"Setup Pruna AI in my app"** and this skill will handle everything.

**Supported Features:**
- Text-to-image generation
- Image-to-video generation
- Image upscaling
- Image editing (inpainting, outpainting)
- Multiple AI models (Stable Diffusion, etc.)

## When to Use

Invoke this skill when you need to:
- Install @umituz/react-native-ai-pruna-provider
- Set up Pruna API for image generation
- Add AI image generation features
- Implement text-to-image
- Create image-to-video features
- Add image upscaling

## Step 1: Analyze the Project

### Check package.json

```bash
cat package.json | grep "@umituz/react-native-ai-pruna-provider"
npm list @umituz/react-native-ai-pruna-provider
```

### Detect Project Type

```bash
cat app.json | grep -q "expo" && echo "Expo" || echo "Bare RN"
```

## Step 2: Install Package

### Install or Update

```bash
npm install @umituz/react-native-ai-pruna-provider@latest
```

### Install Dependencies

```bash
# Required core dependencies
npm install @umituz/react-native-ai-generation-content
npm install @umituz/react-native-design-system
```

## Step 3: Get Pruna API Key

### Create API Key

1. Go to https://pruna.ai/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key

### Add to Environment Variables

Create or update `.env`:

```bash
cat > .env.example << 'EOF'
# Pruna AI Configuration
EXPO_PUBLIC_PRUNA_API_KEY=your_pruna_api_key_here
EOF

# Add to .env
echo "EXPO_PUBLIC_PRUNA_API_KEY=pruna_xxxxxxxxxxxxxxxx" >> .env
```

### Verify API Key

```bash
grep EXPO_PUBLIC_PRUNA_API_KEY .env
```

## Step 4: Initialize Pruna Provider

### Set Up Provider

In your app entry point (`app/_layout.tsx` or `App.tsx`):

```typescript
import { PrunaProvider } from '@umituz/react-native-ai-pruna-provider';
import { ConfigProvider } from '@umituz/react-native-ai-generation-content';

export default function RootLayout() {
  const prunaConfig = {
    apiKey: process.env.EXPO_PUBLIC_PRUNA_API_KEY!,
    defaultModel: 'stable-diffusion-xl',
  };

  return (
    <PrunaProvider config={prunaConfig}>
      <ConfigProvider>
        <Stack>{/* your screens */}</Stack>
      </ConfigProvider>
    </PrunaProvider>
  );
}
```

### Alternative: Manual Initialization

```typescript
import { initializePrunaProvider } from '@umituz/react-native-ai-pruna-provider';

export default function RootLayout() {
  useEffect(() => {
    initializePrunaProvider({
      apiKey: process.env.EXPO_PUBLIC_PRUNA_API_KEY!,
    });
  }, []);

  return <Stack>{/* your screens */}</Stack>;
}
```

### Check If Already Configured

```bash
grep -r "PrunaProvider\|initializePrunaProvider" app/ App.tsx 2>/dev/null
```

## Step 5: Text-to-Image Generation

### Basic Image Generation

```typescript
import { usePrunaGeneration } from '@umituz/react-native-ai-pruna-provider';

export function TextToImageScreen() {
  const { generate, result, isLoading, error } = usePrunaGeneration({
    modelId: 'stable-diffusion-xl',
  });

  const [prompt, setPrompt] = useState('A beautiful sunset over mountains');

  const handleGenerate = async () => {
    try {
      const imageUrl = await generate({
        prompt: prompt,
        negativePrompt: 'blurry, low quality',
        width: 1024,
        height: 1024,
        numInferenceSteps: 30,
        guidanceScale: 7.5,
      });

      console.log('Generated image:', imageUrl);
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };

  return (
    <View>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Describe the image you want..."
        multiline
      />

      {isLoading && <ActivityIndicator />}

      {result && result.images && (
        <Image
          source={{ uri: result.images[0].url }}
          style={{ width: 300, height: 300 }}
        />
      )}

      <Button
        title="Generate Image"
        onPress={handleGenerate}
        disabled={isLoading}
      />
    </View>
  );
}
```

## Step 6: Image-to-Video Generation

### Create Video from Image

```typescript
import { usePrunaGeneration } from '@umituz/react-native-ai-pruna-provider';

export function ImageToVideoScreen() {
  const { generate, result, isLoading } = usePrunaGeneration({
    modelId: 'image-to-video',
  });

  const handleGenerateVideo = async (sourceImage: string) => {
    try {
      const videoUrl = await generate({
        sourceImagePath: sourceImage,
        motionBucketId: 127,
        condAug: 0.02,
        duration: 4, // seconds
      });

      console.log('Generated video:', videoUrl);
      return videoUrl;
    } catch (err) {
      console.error('Video generation failed:', err);
    }
  };

  return (
    <View>
      <Button
        title="Generate Video from Image"
        onPress={() => handleGenerateVideo(imageUri)}
        disabled={isLoading}
      />
    </View>
  );
}
```

## Step 7: Image Upscaling

### Upscale Image

```typescript
import { usePrunaGeneration } from '@umituz/react-native-ai-pruna-provider';

export function UpscaleScreen() {
  const { generate, result, isLoading } = usePrunaGeneration({
    modelId: 'upscale',
  });

  const handleUpscale = async (imageUri: string) => {
    try {
      const upscaledImage = await generate({
        sourceImagePath: imageUri,
        scale: 2, // 2x or 4x
      });

      console.log('Upscaled image:', upscaledImage);
      return upscaledImage;
    } catch (err) {
      console.error('Upscaling failed:', err);
    }
  };

  return (
    <View>
      <Button
        title="Upscale 2x"
        onPress={() => handleUpscale(imageUri)}
        disabled={isLoading}
      />
    </View>
  );
}
```

## Step 8: Image Editing

### Inpainting (Edit parts of image)

```typescript
import { usePrunaGeneration } from '@umituz/react-native-ai-pruna-provider';

export function InpaintScreen() {
  const { generate, result, isLoading } = usePrunaGeneration({
    modelId: 'inpainting',
  });

  const handleInpaint = async (
    imageUri: string,
    maskUri: string,
    prompt: string
  ) => {
    try {
      const editedImage = await generate({
        sourceImagePath: imageUri,
        maskPath: maskUri,
        prompt: prompt,
        inpaintFull: true,
      });

      console.log('Edited image:', editedImage);
      return editedImage;
    } catch (err) {
      console.error('Inpainting failed:', err);
    }
  };

  return (
    <View>
      <Button
        title="Edit Image"
        onPress={() => handleInpaint(imageUri, maskUri, 'remove the object')}
        disabled={isLoading}
      />
    </View>
  );
}
```

## Step 9: Configure Generation Parameters

### Advanced Parameters

```typescript
import { usePrunaGeneration } from '@umituz/react-native-ai-pruna-provider';

export function AdvancedGenerationScreen() {
  const { generate } = usePrunaGeneration({
    modelId: 'stable-diffusion-xl',
  });

  const handleAdvancedGenerate = async () => {
    try {
      const result = await generate({
        prompt: 'A futuristic city at night',
        negativePrompt: 'blurry, low quality, distorted',
        width: 1024,
        height: 768, // 4:3 aspect ratio
        numInferenceSteps: 50, // Higher = better quality but slower
        guidanceScale: 8.5, // Higher = more prompt adherence
        numImages: 1, // Number of images to generate
        seed: 42, // For reproducible results
        scheduler: 'DPMSolverMultistep', // Scheduler type
      });

      return result;
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };

  return (
    <View>
      <Button title="Generate with Advanced Settings" onPress={handleAdvancedGenerate} />
    </View>
  );
}
```

## Step 10: Error Handling

### Handle Common Errors

```typescript
import { PrunaErrorType, usePrunaGeneration } from '@umituz/react-native-ai-pruna-provider';

export function GenerationScreen() {
  const { generate, error, isLoading } = usePrunaGeneration({
    modelId: 'stable-diffusion-xl',
  });

  const handleGenerate = async () => {
    try {
      const result = await generate({
        prompt: 'Generate an image',
      });
      return result;
    } catch (err) {
      if (error?.type === PrunaErrorType.INVALID_API_KEY) {
        Alert.alert('Invalid API Key', 'Check your Pruna API key');
      } else if (error?.type === PrunaErrorType.QUOTA_EXCEEDED) {
        Alert.alert('Quota Exceeded', 'You have exceeded your quota');
      } else if (error?.type === PrunaErrorType.GENERATION_TIMEOUT) {
        Alert.alert('Timeout', 'Generation took too long, try again');
      } else if (error?.type === PrunaErrorType.INVALID_PARAMETERS) {
        Alert.alert('Invalid Parameters', 'Check your generation settings');
      } else {
        Alert.alert('Error', error?.message || 'Generation failed');
      }
    }
  };

  return <View>{/* UI */}</View>;
}
```

## Step 11: Verify Setup

### Run the App

```bash
# For Expo
npx expo start

# For bare React Native
npx react-native run-ios
# or
npx react-native run-android
```

### Verification Checklist

- ✅ Package installed
- ✅ API key configured
- ✅ Provider initialized
- ✅ Text-to-image works
- ✅ Image-to-video works
- ✅ Upscaling works
- ✅ Error handling works

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Missing API key | Add EXPO_PUBLIC_PRUNA_API_KEY to .env |
| Invalid API key | Verify key at Pruna dashboard |
| Provider not initialized | Call initializePrunaProvider or wrap with PrunaProvider |
| Wrong model ID | Use valid model IDs (stable-diffusion-xl, etc.) |
| Large image timeouts | Increase timeout or reduce image size |
| Memory issues | Limit concurrent generations |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **"Invalid API key"** | Check key format and verify at pruna.ai |
| **"Generation timeout"** | Reduce image size or steps, increase timeout |
| **"Quota exceeded"** | Check your Pruna usage limits |
| **"Model not found"** | Verify model ID is supported by Pruna |
| **"Out of memory"** | Limit concurrent requests or reduce resolution |

## Supported Models

### Text-to-Image

- **stable-diffusion-xl** - High quality image generation
- **stable-diffusion-2.1** - Standard quality
- **stable-diffusion-turbo** - Fast generation

### Image-to-Video

- **image-to-video** - Convert image to video
- **animate-diff** - Animated video generation

### Image Processing

- **upscale** - 2x or 4x upscaling
- **inpainting** - Edit parts of image
- **outpainting** - Extend image boundaries

## Pricing and Limits

Pruna AI uses credit-based system:

- Text-to-image: ~10-50 credits per image
- Image-to-video: ~100-500 credits per video
- Upscaling: ~5-20 credits per image

See https://pruna.ai/pricing for current rates.

## Summary

After setup, provide:

1. ✅ Package version installed
2. ✅ API key configured
3. ✅ Provider initialization location
4. ✅ Model(s) configured
5. ✅ Generation features working
6. ✅ Error handling configured
7. ✅ Verification status

---

**Compatible with:** @umituz/react-native-ai-pruna-provider@latest
**Platforms:** React Native (Expo & Bare)
**API:** Pruna AI (https://pruna.ai/)
**Cost:** Credit-based system
