/**
 * Pruna Input Builder
 * Builds model-specific payloads from generic input.
 *
 * Each Pruna model has strict schema requirements:
 *   p-image:      { prompt, aspect_ratio? }
 *   p-image-edit: { images: string[], prompt, aspect_ratio? }
 *   p-video:      { image: string (URL), prompt, duration, resolution, fps, draft, aspect_ratio, prompt_upsampling, audio? }
 */

import type { PrunaModelId, PrunaAspectRatio, PrunaResolution } from "../../domain/entities/pruna.types";
import { P_VIDEO_DEFAULTS, DEFAULT_ASPECT_RATIO } from "./pruna-provider.constants";
import { uploadFileToStorage } from "./pruna-api-client";
import { generationLogCollector } from "../utils/log-collector";

const TAG = 'pruna-input-builder';

/**
 * Build model-specific input payload from generic input.
 * Handles image uploads for p-video (requires file URL).
 */
export async function buildModelInput(
  model: PrunaModelId,
  input: Record<string, unknown>,
  apiKey: string,
  sessionId: string,
): Promise<Record<string, unknown>> {
  generationLogCollector.log(sessionId, TAG, `>>> buildModelInput START`, {
    model,
    inputKeys: Object.keys(input),
    hasPrompt: !!input.prompt,
    hasAspectRatio: !!input.aspect_ratio,
  });

  const prompt = input.prompt as string | undefined;
  if (!prompt) {
    generationLogCollector.error(sessionId, TAG, 'Prompt validation FAILED: missing prompt');
    throw new Error("Prompt is required for all Pruna models.");
  }

  const aspectRatio = (input.aspect_ratio as PrunaAspectRatio) || DEFAULT_ASPECT_RATIO;
  generationLogCollector.log(sessionId, TAG, `Prompt validation OK`, {
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 50) + '...',
    aspectRatio,
  });

  if (model === 'p-image') {
    generationLogCollector.log(sessionId, TAG, `Routing to buildImageInput`);
    return buildImageInput(prompt, aspectRatio, input);
  }

  if (model === 'p-image-edit') {
    generationLogCollector.log(sessionId, TAG, `Routing to buildImageEditInput`);
    return await buildImageEditInput(prompt, aspectRatio, input, apiKey, sessionId);
  }

  if (model === 'p-video') {
    generationLogCollector.log(sessionId, TAG, `Routing to buildVideoInput`);
    return await buildVideoInput(prompt, aspectRatio, input, apiKey, sessionId);
  }

  generationLogCollector.error(sessionId, TAG, `Unknown model: ${model}`);
  throw new Error(`Unknown Pruna model: ${model}`);
}

function buildImageInput(
  prompt: string,
  aspectRatio: PrunaAspectRatio,
  input: Record<string, unknown>,
): Record<string, unknown> {
  generationLogCollector.log('build-image-input', TAG, `buildImageInput START`, {
    promptLength: prompt.length,
    aspectRatio,
    optionalParams: Object.keys(input).filter(k => !['prompt', 'aspect_ratio'].includes(k)),
  });

  const payload: Record<string, unknown> = { prompt, aspect_ratio: aspectRatio };

  if (input.seed !== undefined) payload.seed = input.seed;
  if (input.disable_safety_checker !== undefined) payload.disable_safety_checker = input.disable_safety_checker;
  if (input.width !== undefined) payload.width = input.width;
  if (input.height !== undefined) payload.height = input.height;

  generationLogCollector.log('build-image-input', TAG, `buildImageInput COMPLETE`, {
    payloadKeys: Object.keys(payload),
    hasSeed: !!payload.seed,
    hasDimensions: !!(payload.width || payload.height),
  });

  return payload;
}

async function buildImageEditInput(
  prompt: string,
  aspectRatio: PrunaAspectRatio,
  input: Record<string, unknown>,
  apiKey: string,
  sessionId: string,
): Promise<Record<string, unknown>> {
  generationLogCollector.log(sessionId, TAG, `>>> buildImageEditInput START`, {
    promptLength: prompt.length,
    aspectRatio,
    inputKeys: Object.keys(input),
  });

  // p-image-edit: Upload images to file storage and use URLs (required by Pruna API)
  // Get base64 image(s) from input
  let rawImages: string[];

  generationLogCollector.log(sessionId, TAG, `Detecting image source...`, {
    hasImages: Array.isArray(input.images),
    hasImage: typeof input.image === 'string',
    hasImageUrl: typeof input.image_url === 'string',
    hasImageUrls: Array.isArray(input.image_urls),
  });

  if (Array.isArray(input.images)) {
    const validImages = (input.images as unknown[]).filter((img): img is string => typeof img === 'string');
    if (validImages.length === 0) {
      generationLogCollector.error(sessionId, TAG, 'Image array validation FAILED: empty or invalid');
      throw new Error("Image array is empty or contains no valid strings for p-image-edit.");
    }
    rawImages = validImages;
    generationLogCollector.log(sessionId, TAG, `Image source: 'images' array`, { count: rawImages.length });
  } else if (typeof input.image === 'string') {
    rawImages = [input.image as string];
    generationLogCollector.log(sessionId, TAG, `Image source: 'image' string`, {
      length: rawImages[0].length,
      isBase64: rawImages[0].includes('base64'),
      isHttp: rawImages[0].startsWith('http'),
    });
  } else if (typeof input.image_url === 'string') {
    rawImages = [input.image_url as string];
    generationLogCollector.log(sessionId, TAG, `Image source: 'image_url' string`);
  } else if (Array.isArray(input.image_urls)) {
    rawImages = input.image_urls as string[];
    generationLogCollector.log(sessionId, TAG, `Image source: 'image_urls' array`, { count: rawImages.length });
  } else {
    generationLogCollector.error(sessionId, TAG, 'Image validation FAILED: no valid image source found');
    throw new Error("Image is required for p-image-edit. Provide 'image', 'images', 'image_url', or 'image_urls'.");
  }

  generationLogCollector.log(sessionId, TAG, `p-image-edit: starting upload of ${rawImages.length} image(s)...`);

  // Upload images to Pruna file storage and collect URLs
  const imageUrls: string[] = [];
  for (let i = 0; i < rawImages.length; i++) {
    const rawImage = rawImages[i];
    const uploadStart = Date.now();

    generationLogCollector.log(sessionId, TAG, `p-image-edit: [${i + 1}/${rawImages.length}] Starting upload...`, {
      imageSizeKB: Math.round(rawImage.length / 1024),
      isBase64: rawImage.includes('base64'),
      isUrl: rawImage.startsWith('http'),
    });

    // Upload to file storage (if already a URL, it will be returned as-is)
    const fileUrl = await uploadFileToStorage(rawImage, apiKey, sessionId);
    imageUrls.push(fileUrl);

    const uploadElapsed = Date.now() - uploadStart;
    generationLogCollector.log(sessionId, TAG, `p-image-edit: [${i + 1}/${rawImages.length}] Upload complete`, {
      fileUrl: fileUrl.substring(0, 80) + '...',
      elapsedMs: uploadElapsed,
    });
  }

  generationLogCollector.log(sessionId, TAG, `All images uploaded successfully`, {
    totalImages: imageUrls.length,
  });

  // Build payload with image URLs (not raw base64)
  const payload: Record<string, unknown> = {
    images: imageUrls,  // Array of HTTPS URLs from file upload
    prompt,
    aspect_ratio: aspectRatio,
  };

  // __DEV__ log final payload
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[DEV] [${TAG}] Final p-image-edit payload:`, {
      imageCount: imageUrls.length,
      promptLength: prompt.length,
      aspectRatio,
      firstImageUrl: imageUrls[0]?.substring(0, 60) + '...',
      payloadSizeKB: Math.round(JSON.stringify(payload).length / 1024),
    });
  }

  // Optional parameters for quality control
  if (input.seed !== undefined) payload.seed = input.seed;
  if (input.disable_safety_checker !== undefined) payload.disable_safety_checker = input.disable_safety_checker;
  if (input.width !== undefined) payload.width = input.width;
  if (input.height !== undefined) payload.height = input.height;

  // Pruna API supported parameters - ONLY add supported ones!
  // p-image-edit supports: images, prompt, aspect_ratio, seed (maybe)
  // Does NOT support: num_inference_steps, guidance_scale, strength

  generationLogCollector.log(sessionId, TAG, `<<< buildImageEditInput COMPLETE`, {
    payloadKeys: Object.keys(payload),
    imageCount: imageUrls.length,
    hasSeed: !!payload.seed,
  });

  return payload;
}

async function buildVideoInput(
  prompt: string,
  aspectRatio: PrunaAspectRatio,
  input: Record<string, unknown>,
  apiKey: string,
  sessionId: string,
): Promise<Record<string, unknown>> {
  generationLogCollector.log(sessionId, TAG, `>>> buildVideoInput START`, {
    promptLength: prompt.length,
    aspectRatio,
    inputKeys: Object.keys(input),
  });

  // p-video requires an image file URL
  const rawImage = (input.image as string) || (input.image_url as string);
  if (!rawImage) {
    generationLogCollector.error(sessionId, TAG, 'Video image validation FAILED: no image provided');
    throw new Error("Image is required for p-video. Provide 'image' or 'image_url'.");
  }

  generationLogCollector.log(sessionId, TAG, 'p-video: preparing image for video generation...', {
    imageSizeKB: Math.round(rawImage.length / 1024),
    isBase64: rawImage.includes('base64'),
    isUrl: rawImage.startsWith('http'),
  });

  // Upload base64 to file storage if needed (p-video requires HTTPS URL)
  const uploadStart = Date.now();
  const fileUrl = await uploadFileToStorage(rawImage, apiKey, sessionId);
  const uploadElapsed = Date.now() - uploadStart;

  generationLogCollector.log(sessionId, TAG, 'p-video: image upload complete', {
    fileUrl: fileUrl.substring(0, 80) + '...',
    elapsedMs: uploadElapsed,
  });

  const duration = (input.duration as number) ?? P_VIDEO_DEFAULTS.duration;
  const resolution = (input.resolution as PrunaResolution) ?? P_VIDEO_DEFAULTS.resolution;
  const draft = (input.draft as boolean) ?? P_VIDEO_DEFAULTS.draft;

  const fps = (input.fps as number) ?? P_VIDEO_DEFAULTS.fps;
  const promptUpsampling = (input.prompt_upsampling as boolean) ?? P_VIDEO_DEFAULTS.promptUpsampling;

  generationLogCollector.log(sessionId, TAG, 'p-video: video parameters', {
    duration,
    resolution,
    fps,
    draft,
    promptUpsampling,
  });

  const payload: Record<string, unknown> = {
    image: fileUrl,
    prompt,
    duration,
    resolution,
    fps,
    draft,
    aspect_ratio: aspectRatio,
    prompt_upsampling: promptUpsampling,
  };

  // Handle audio input — upload to file storage if base64, pass URL if already remote
  const rawAudio = input.audio as string | undefined;
  if (rawAudio) {
    generationLogCollector.log(sessionId, TAG, 'p-video: preparing audio for video generation...', {
      audioSizeKB: Math.round(rawAudio.length / 1024),
      isBase64: rawAudio.includes('base64'),
      isUrl: rawAudio.startsWith('http'),
    });

    const audioUploadStart = Date.now();
    const audioUrl = await uploadFileToStorage(rawAudio, apiKey, sessionId);
    const audioUploadElapsed = Date.now() - audioUploadStart;

    payload.audio = audioUrl;
    generationLogCollector.log(sessionId, TAG, 'p-video: audio upload complete', {
      audioUrl: audioUrl.substring(0, 80) + '...',
      elapsedMs: audioUploadElapsed,
    });
  }

  if (input.disable_safety_checker !== undefined) payload.disable_safety_checker = input.disable_safety_checker;

  generationLogCollector.log(sessionId, TAG, `<<< buildVideoInput COMPLETE`, {
    payloadKeys: Object.keys(payload),
    hasAudio: !!payload.audio,
    videoParams: { duration, resolution, fps, draft },
  });

  return payload;
}
