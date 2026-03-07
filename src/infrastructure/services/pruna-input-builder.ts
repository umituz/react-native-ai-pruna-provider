/**
 * Pruna Input Builder
 * Builds model-specific payloads from generic input.
 *
 * Each Pruna model has strict schema requirements:
 *   p-image:      { prompt, aspect_ratio? }
 *   p-image-edit: { images: string[], prompt, aspect_ratio? }
 *   p-video:      { image: string (URL), prompt, duration, resolution, fps, draft, aspect_ratio, prompt_upsampling }
 */

import type { PrunaModelId, PrunaAspectRatio, PrunaResolution } from "../../domain/entities/pruna.types";
import { P_VIDEO_DEFAULTS, DEFAULT_ASPECT_RATIO } from "./pruna-provider.constants";
import { uploadImageToFiles, stripBase64Prefix } from "./pruna-api-client";
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

  if (input.seed !== undefined) {
    payload.seed = input.seed;
  }

  return payload;
}

function buildImageEditInput(
  prompt: string,
  aspectRatio: PrunaAspectRatio,
  input: Record<string, unknown>,
  sessionId: string,
): Record<string, unknown> {
  // p-image-edit expects images array
  let images: string[];

  if (Array.isArray(input.images)) {
    images = (input.images as string[]).map(stripBase64Prefix);
  } else if (typeof input.image === 'string') {
    images = [stripBase64Prefix(input.image as string)];
  } else if (typeof input.image_url === 'string') {
    images = [stripBase64Prefix(input.image_url as string)];
  } else if (Array.isArray(input.image_urls)) {
    images = (input.image_urls as string[]).map(stripBase64Prefix);
  } else {
    throw new Error("Image is required for p-image-edit. Provide 'image', 'images', 'image_url', or 'image_urls'.");
  }

  generationLogCollector.log(sessionId, TAG, `p-image-edit: ${images.length} image(s) prepared`);

  const payload: Record<string, unknown> = { images, prompt, aspect_ratio: aspectRatio };

  if (input.seed !== undefined) {
    payload.seed = input.seed;
  }

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
  const fileUrl = await uploadImageToFiles(rawImage, apiKey, sessionId);

  const duration = (input.duration as number) ?? P_VIDEO_DEFAULTS.duration;
  const resolution = (input.resolution as PrunaResolution) ?? P_VIDEO_DEFAULTS.resolution;
  const draft = (input.draft as boolean) ?? P_VIDEO_DEFAULTS.draft;

  return {
    image: fileUrl,
    prompt,
    duration,
    resolution,
    fps: P_VIDEO_DEFAULTS.fps,
    draft,
    aspect_ratio: aspectRatio,
    prompt_upsampling: P_VIDEO_DEFAULTS.promptUpsampling,
  };
}
