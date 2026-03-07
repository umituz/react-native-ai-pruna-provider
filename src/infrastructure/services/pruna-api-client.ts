/**
 * Pruna API Client
 * Low-level HTTP interactions with the Pruna AI API
 *
 * Endpoints:
 *   POST /v1/predictions  — submit generation (with Try-Sync header for immediate results)
 *   POST /v1/files        — upload images for p-video (requires file URL, not base64)
 *   GET  {poll_url}       — poll async results
 *
 * Authentication: `apikey` header
 * Model selection: `Model` header
 */

import type { PrunaModelId, PrunaPredictionResponse, PrunaFileUploadResponse } from "../../domain/entities/pruna.types";
import { PRUNA_BASE_URL, PRUNA_PREDICTIONS_URL, PRUNA_FILES_URL } from "./pruna-provider.constants";
import { generationLogCollector } from "../utils/log-collector";

const TAG = 'pruna-api';

/**
 * Upload a base64 image to Pruna's file storage.
 * p-video requires a file URL (not raw base64).
 * Returns the HTTPS file URL to use in predictions.
 */
export async function uploadImageToFiles(
  base64Data: string,
  apiKey: string,
  sessionId: string,
): Promise<string> {
  // Already a URL — return as-is
  if (base64Data.startsWith('http')) {
    generationLogCollector.log(sessionId, TAG, 'Image already a URL, skipping upload');
    return base64Data;
  }

  generationLogCollector.log(sessionId, TAG, 'Uploading image to Pruna file storage...');

  // Strip data URI prefix if present
  const raw = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;

  let binaryStr: string;
  try {
    binaryStr = atob(raw);
  } catch {
    throw new Error("Invalid image format. Please provide base64 or a valid URL.");
  }

  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Detect MIME from first bytes
  let mime = 'image/png';
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) mime = 'image/jpeg';
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) mime = 'image/webp';

  const blob = new Blob([bytes], { type: mime });
  const ext = mime.split('/')[1];
  const formData = new FormData();
  formData.append('content', blob, `upload.${ext}`);

  const startTime = Date.now();

  const response = await fetch(PRUNA_FILES_URL, {
    method: 'POST',
    headers: { 'apikey': apiKey },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    const errorMessage = (err as { message?: string }).message || `File upload error: ${response.status}`;
    generationLogCollector.error(sessionId, TAG, `File upload failed: ${errorMessage}`);
    throw new Error(errorMessage);
  }

  const data: PrunaFileUploadResponse = await response.json();
  const fileUrl = data.urls?.get || `${PRUNA_FILES_URL}/${data.id}`;

  const elapsed = Date.now() - startTime;
  generationLogCollector.log(sessionId, TAG, `File upload completed in ${elapsed}ms → ${fileUrl}`);

  return fileUrl;
}

/**
 * Strip base64 data URI prefix, returning raw base64 string.
 * If input is already a URL, returns it unchanged.
 */
export function stripBase64Prefix(image: string): string {
  if (image.startsWith('http')) return image;
  return image.includes('base64,') ? image.split('base64,')[1] : image;
}

/**
 * Submit a prediction to Pruna AI.
 * Uses Try-Sync header for potential immediate results.
 * Returns raw response (may contain result or polling URL).
 */
export async function submitPrediction(
  model: PrunaModelId,
  input: Record<string, unknown>,
  apiKey: string,
  sessionId: string,
): Promise<PrunaPredictionResponse> {
  generationLogCollector.log(sessionId, TAG, `Submitting prediction for model: ${model}`, {
    inputKeys: Object.keys(input),
  });

  const startTime = Date.now();

  const response = await fetch(PRUNA_PREDICTIONS_URL, {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Model': model,
      'Try-Sync': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    const errorMessage = (errorData as { message?: string }).message || `API error: ${response.status}`;

    generationLogCollector.error(sessionId, TAG, `Prediction failed (${response.status}): ${errorMessage}`);

    const error = new Error(errorMessage);
    (error as Error & { statusCode?: number }).statusCode = response.status;
    throw error;
  }

  const elapsed = Date.now() - startTime;
  const result: PrunaPredictionResponse = await response.json();

  generationLogCollector.log(sessionId, TAG, `Prediction response received in ${elapsed}ms`, {
    hasUri: !!extractUri(result),
    hasGetUrl: !!result.get_url,
    hasStatusUrl: !!result.status_url,
    status: result.status,
  });

  return result;
}

/**
 * Poll for async prediction results.
 * Polls every 3 seconds up to maxAttempts (~6 min at 120 attempts).
 */
export async function pollForResult(
  pollUrl: string,
  apiKey: string,
  sessionId: string,
  maxAttempts: number,
  intervalMs: number,
  signal?: AbortSignal,
): Promise<string> {
  const fullPollUrl = pollUrl.startsWith('http') ? pollUrl : `${PRUNA_BASE_URL}${pollUrl}`;

  generationLogCollector.log(sessionId, TAG, `Starting polling at ${fullPollUrl} (max ${maxAttempts} attempts, ${intervalMs}ms interval)`);

  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) {
      throw new Error("Request cancelled by user");
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));

    if (signal?.aborted) {
      throw new Error("Request cancelled by user");
    }

    try {
      const statusRes = await fetch(fullPollUrl, {
        headers: { 'apikey': apiKey },
      });

      if (!statusRes.ok) {
        generationLogCollector.warn(sessionId, TAG, `Poll attempt ${i + 1}/${maxAttempts}: HTTP ${statusRes.status}, skipping...`);
        continue;
      }

      const statusData: PrunaPredictionResponse = await statusRes.json();

      if (statusData.status === 'succeeded' || statusData.status === 'completed') {
        const uri = extractUri(statusData);
        if (uri) {
          generationLogCollector.log(sessionId, TAG, `Polling completed at attempt ${i + 1}/${maxAttempts}`);
          return resolveUri(uri);
        }
      } else if (statusData.status === 'failed') {
        const errorMessage = statusData.error || "Generation failed during processing.";
        generationLogCollector.error(sessionId, TAG, `Polling: generation failed — ${errorMessage}`);
        throw new Error(errorMessage);
      }

      // Still processing — log progress periodically
      if ((i + 1) % 10 === 0) {
        generationLogCollector.log(sessionId, TAG, `Polling: still processing (attempt ${i + 1}/${maxAttempts})...`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("cancelled by user")) {
        throw error;
      }
      // Non-fatal poll error — continue polling
      if (error instanceof Error && !error.message.includes("failed during processing")) {
        generationLogCollector.warn(sessionId, TAG, `Poll attempt ${i + 1} error: ${error.message}`);
        continue;
      }
      throw error;
    }
  }

  throw new Error("Generation timed out. Maximum polling attempts reached.");
}

/**
 * Extract result URI from Pruna API response.
 * Checks multiple possible locations (priority order).
 */
export function extractUri(data: PrunaPredictionResponse): string | null {
  return (
    data.generation_url ||
    (data.output && typeof data.output === 'object' && !Array.isArray(data.output) ? (data.output as { url: string }).url : null) ||
    (typeof data.output === 'string' ? data.output : null) ||
    data.data ||
    data.video_url ||
    (Array.isArray(data.output) ? data.output[0] : null) ||
    null
  );
}

/**
 * Resolve relative URIs to absolute URLs
 */
export function resolveUri(uri: string): string {
  if (uri.startsWith('/')) {
    return `${PRUNA_BASE_URL}${uri}`;
  }
  return uri;
}
