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
import { uploadFileToStorage, stripBase64Prefix } from "./pruna-api-client";
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
  const prompt = input.prompt as string | undefined;
  if (!prompt) {
    throw new Error("Prompt is required for all Pruna models.");
  }

  const aspectRatio = (input.aspect_ratio as PrunaAspectRatio) || DEFAULT_ASPECT_RATIO;

  if (model === 'p-image') {
    return buildImageInput(prompt, aspectRatio, input);
  }

  if (model === 'p-image-edit') {
    return buildImageEditInput(prompt, aspectRatio, input, sessionId);
  }

  if (model === 'p-video') {
    return buildVideoInput(prompt, aspectRatio, input, apiKey, sessionId);
  }

  throw new Error(`Unknown Pruna model: ${model}`);
}

function buildImageInput(
  prompt: string,
  aspectRatio: PrunaAspectRatio,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { prompt, aspect_ratio: aspectRatio };

  if (input.seed !== undefined) payload.seed = input.seed;
  if (input.disable_safety_checker !== undefined) payload.disable_safety_checker = input.disable_safety_checker;
  if (input.width !== undefined) payload.width = input.width;
  if (input.height !== undefined) payload.height = input.height;

  return payload;
}

function buildImageEditInput(
  prompt: string,
  aspectRatio: PrunaAspectRatio,
  input: Record<string, unknown>,
  sessionId: string,
): Record<string, unknown> {
  // p-image-edit expects images array (base64 with data URI prefix or HTTPS URLs)
  // Base64 format: data:image/jpeg;base64,{base64_string}
  let images: string[];

  if (Array.isArray(input.images)) {
    const validImages = (input.images as unknown[]).filter((img): img is string => typeof img === 'string');
    if (validImages.length === 0) {
      throw new Error("Image array is empty or contains no valid strings for p-image-edit.");
    }
    images = validImages; // Keep data URI prefix for base64 images
  } else if (typeof input.image === 'string') {
    images = [input.image as string]; // Keep data URI prefix for base64 images
  } else if (typeof input.image_url === 'string') {
    images = [input.image_url as string]; // Keep data URI prefix for base64 images
  } else if (Array.isArray(input.image_urls)) {
    images = input.image_urls as string[]; // Keep data URI prefix for base64 images
  } else {
    throw new Error("Image is required for p-image-edit. Provide 'image', 'images', 'image_url', or 'image_urls'.");
  }

  generationLogCollector.log(sessionId, TAG, `p-image-edit: ${images.length} image(s) prepared`);

  const payload: Record<string, unknown> = { images, prompt, aspect_ratio: aspectRatio };

  if (input.seed !== undefined) payload.seed = input.seed;
  if (input.disable_safety_checker !== undefined) payload.disable_safety_checker = input.disable_safety_checker;
  if (input.width !== undefined) payload.width = input.width;
  if (input.height !== undefined) payload.height = input.height;

  return payload;
}

async function buildVideoInput(
  prompt: string,
  aspectRatio: PrunaAspectRatio,
  input: Record<string, unknown>,
  apiKey: string,
  sessionId: string,
): Promise<Record<string, unknown>> {
  // p-video requires an image file URL
  const rawImage = (input.image as string) || (input.image_url as string);
  if (!rawImage) {
    throw new Error("Image is required for p-video. Provide 'image' or 'image_url'.");
  }

  // Upload base64 to file storage if needed (p-video requires HTTPS URL)
  generationLogCollector.log(sessionId, TAG, 'p-video: preparing image for video generation...');
  const fileUrl = await uploadFileToStorage(rawImage, apiKey, sessionId);

  const duration = (input.duration as number) ?? P_VIDEO_DEFAULTS.duration;
  const resolution = (input.resolution as PrunaResolution) ?? P_VIDEO_DEFAULTS.resolution;
  const draft = (input.draft as boolean) ?? P_VIDEO_DEFAULTS.draft;

  const fps = (input.fps as number) ?? P_VIDEO_DEFAULTS.fps;
  const promptUpsampling = (input.prompt_upsampling as boolean) ?? P_VIDEO_DEFAULTS.promptUpsampling;

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
    generationLogCollector.log(sessionId, TAG, 'p-video: preparing audio for video generation...');
    const audioUrl = await uploadFileToStorage(rawAudio, apiKey, sessionId);
    payload.audio = audioUrl;
    generationLogCollector.log(sessionId, TAG, 'p-video: audio attached — duration will be determined by audio length');
  }

  if (input.disable_safety_checker !== undefined) payload.disable_safety_checker = input.disable_safety_checker;

  return payload;
}
