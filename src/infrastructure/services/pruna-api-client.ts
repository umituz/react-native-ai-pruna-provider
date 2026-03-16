/**
 * Pruna API Client
 * Low-level HTTP interactions with the Pruna AI API
 *
 * Endpoints:
 *   POST /v1/predictions  — submit generation (with Try-Sync header for immediate results)
 *   POST /v1/files        — upload files (images, audio) for p-video (requires file URL, not base64)
 *   GET  {poll_url}       — poll async results
 *
 * Authentication: `apikey` header
 * Model selection: `Model` header
 */

import type { PrunaModelId, PrunaPredictionResponse, PrunaFileUploadResponse } from "../../domain/entities/pruna.types";
import { PRUNA_BASE_URL, PRUNA_PREDICTIONS_URL, PRUNA_FILES_URL, UPLOAD_CONFIG } from "./pruna-provider.constants";
import { generationLogCollector } from "../utils/log-collector";
import { bytesToKB, calculateElapsedMs, createStringPreview } from "../utils/calculation.utils";

const TAG = 'pruna-api';

/**
 * Upload a base64 file (image or audio) to Pruna's file storage.
 * Uses design system filesystem for React Native compatibility.
 * Returns the HTTPS file URL to use in predictions.
 */
export async function uploadFileToStorage(
  base64Data: string,
  apiKey: string,
  sessionId: string,
): Promise<string> {
  generationLogCollector.log(sessionId, TAG, `>>> uploadFileToStorage START`, {
    dataLength: base64Data.length,
    startsWithHttp: base64Data.startsWith('http'),
    startsWithDataUri: base64Data.startsWith('data:'),
  });

  // Guard: empty or whitespace-only input
  if (!base64Data || !base64Data.trim()) {
    generationLogCollector.error(sessionId, TAG, 'File data validation FAILED: empty input');
    throw new Error("File data is empty. Provide a base64 string or URL.");
  }

  // Already a URL — return as-is
  if (base64Data.startsWith('http')) {
    generationLogCollector.log(sessionId, TAG, 'File already a URL, skipping upload', {
      url: base64Data.substring(0, 80) + '...',
    });
    return base64Data;
  }

  generationLogCollector.log(sessionId, TAG, 'Uploading file to Pruna storage...');

  // __DEV__ log input data size
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const dataSizeKB = bytesToKB(base64Data.length);
    console.log(`[DEV] [${TAG}] File upload input:`, {
      dataSizeKB,
      startsWithDataUri: base64Data.startsWith('data:'),
      preview: createStringPreview(base64Data, 50),
    });
  }

  // Strip data URI prefix if present to get raw base64
  const rawBase64 = base64Data.includes('base64,')
    ? base64Data.split('base64,')[1]
    : base64Data;

  generationLogCollector.log(sessionId, TAG, 'Base64 processing complete', {
    originalLength: base64Data.length,
    rawLength: rawBase64.length,
    hadDataUriPrefix: base64Data.includes('base64,'),
  });

  // Use default JPEG MIME type (detectMimeType fails on base64)
  const mimeType = 'image/jpeg';
  const dataUri = `data:${mimeType};base64,${rawBase64}`;

  generationLogCollector.log(sessionId, TAG, `Creating data URI for upload (${mimeType})...`);

  // __DEV__ log upload details
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[DEV] [${TAG}] Data URI upload:`, {
      mimeType,
      base64Length: rawBase64.length,
      dataUriPrefix: dataUri.substring(0, 50) + '...',
    });
  }

  const startTime = Date.now();

  // Apply timeout to prevent indefinite hangs
  const uploadController = new AbortController();
  const timeoutId = setTimeout(() => uploadController.abort(), UPLOAD_CONFIG.timeoutMs);

  try {
    // Create FormData with file object format (React Native compatible)
    const formData = new FormData();

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const uniqueFileName = `vivoim_${timestamp}_${randomId}.jpg`;

    // React Native expects {uri, type, name} format for file uploads
    const fileObject = {
      uri: dataUri,
      type: mimeType,
      name: uniqueFileName,
    } as {
      uri: string;
      type: string;
      name: string;
    };

    // Type cast for React Native FormData which accepts file objects
    (formData as unknown as { append: (name: string, value: typeof fileObject) => void }).append('content', fileObject);

    generationLogCollector.log(sessionId, TAG, 'FormData created', {
      hasContent: (formData as unknown as { has?: (key: string) => boolean }).has?.('content') ?? true,
      fileName: fileObject.name,
      mimeType: fileObject.type,
    });

    // __DEV__ log FormData
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[DEV] [${TAG}] FormData created (file object format):`, {
        hasContent: (formData as unknown as { has?: (key: string) => boolean }).has?.('content') ?? true,
        fileObject: {
          uri: fileObject.uri.substring(0, 50) + '...',
          type: fileObject.type,
          name: fileObject.name,
        },
      });
    }

    // __DEV__ log request details
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[DEV] [${TAG}] Sending upload request:`, {
        url: PRUNA_FILES_URL,
        method: 'POST',
        hasContent: (formData as unknown as { has?: (key: string) => boolean }).has?.('content') ?? true,
      });
    }

    const uploadStart = Date.now();
    generationLogCollector.log(sessionId, TAG, 'Sending POST request to file storage...');

    const uploadResponse = await fetch(PRUNA_FILES_URL, {
      method: 'POST',
      headers: { 'apikey': apiKey },
      body: formData,
      signal: uploadController.signal,
    });

    // Clear timeout immediately after fetch completes to prevent race condition
    clearTimeout(timeoutId);

    const uploadElapsed = calculateElapsedMs(uploadStart);
    generationLogCollector.log(sessionId, TAG, 'Upload response received', {
      statusCode: uploadResponse.status,
      statusText: uploadResponse.statusText,
      elapsedMs: uploadElapsed,
    });

    if (!uploadResponse.ok) {
      // Get response details for debugging
      const statusText = uploadResponse.statusText;
      const status = uploadResponse.status;

      // Try to get error details from response
      let rawBody = '';
      let errorDetails: Record<string, unknown> = {};

      try {
        rawBody = await uploadResponse.text();
        if (rawBody) {
          try {
            errorDetails = JSON.parse(rawBody) as Record<string, unknown>;
          } catch {
            // If not JSON, keep raw text for error message
          }
        }
      } catch (bodyError) {
        // If reading body fails, log the error but continue with status info
        generationLogCollector.warn(sessionId, TAG, 'Failed to read error response body', {
          error: bodyError instanceof Error ? bodyError.message : String(bodyError),
        });
      }

      const errorMessage = (errorDetails as { message?: string; detail?: string; error?: string }).message ||
                         (errorDetails as { detail?: string }).detail ||
                         (errorDetails as { error?: string }).error ||
                         rawBody ||
                         `File upload error: ${status}`;

      generationLogCollector.error(sessionId, TAG, `File upload FAILED`, {
        status,
        statusText,
        errorMessage,
        rawBodyLength: rawBody.length,
      });

      // __DEV__ detailed error logging
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.error(`[DEV] [${TAG}] File upload FAILED:`, {
          status,
          statusText,
          errorMessage,
          rawBody: rawBody.substring(0, 1000),
          errorDetails,
          url: PRUNA_FILES_URL,
          formDataPreview: {
            hasContent: (formData as unknown as { has?: (key: string) => boolean }).has?.('content') ?? true,
            contentType: (formData as unknown as { get?: (key: string) => unknown }).get?.('content')?.toString().substring(0, 100) + '...',
          },
        });
      }

      throw new Error(errorMessage);
    }

    const data: PrunaFileUploadResponse = await uploadResponse.json();
    const fileUrl = data.urls?.get || `${PRUNA_FILES_URL}/${data.id}`;

    const elapsed = calculateElapsedMs(startTime);
    generationLogCollector.log(sessionId, TAG, `File upload completed in ${elapsed}ms`, {
      fileId: data.id,
      fileUrl: createStringPreview(fileUrl),
      responseKeys: Object.keys(data),
      hasUrlsGet: !!data.urls?.get,
    });

    // __DEV__ log response details
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[DEV] [${TAG}] File upload SUCCESS:`, {
        elapsedMs: elapsed,
        fileId: data.id,
        fileUrl,
        urls: data.urls,
        responseKeys: Object.keys(data),
      });
    }

    generationLogCollector.log(sessionId, TAG, `<<< uploadFileToStorage COMPLETE`, {
      totalElapsedMs: elapsed,
      resultUrl: fileUrl.substring(0, 60) + '...',
    });

    return fileUrl;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      generationLogCollector.error(sessionId, TAG, `File upload timed out after ${UPLOAD_CONFIG.timeoutMs}ms`);
      throw new Error(`File upload timed out after ${UPLOAD_CONFIG.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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
  signal?: AbortSignal,
): Promise<PrunaPredictionResponse> {
  generationLogCollector.log(sessionId, TAG, `>>> submitPrediction START`, {
    model,
    inputKeys: Object.keys(input),
    hasSignal: !!signal,
  });

  const startTime = Date.now();

  const requestBody = { input };

  // __DEV__ detailed request logging
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const inputSummary: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' && value.length > 100) {
        inputSummary[key] = `[string ${value.length} chars]`;
      } else if (Array.isArray(value)) {
        inputSummary[key] = `[array ${value.length} items]`;
      } else {
        inputSummary[key] = JSON.stringify(value);
      }
    }
    console.log(`[DEV] [${TAG}] Request details:`, {
      url: PRUNA_PREDICTIONS_URL,
      model,
      modelHeader: model,
      bodyTopLevelKeys: Object.keys(requestBody),
      inputKeys: Object.keys(input),
      inputSummary,
      requestBodySizeKB: bytesToKB(JSON.stringify(requestBody).length),
    });
  }

  generationLogCollector.log(sessionId, TAG, `Sending POST request...`, {
    url: PRUNA_PREDICTIONS_URL,
    model,
    bodyKeys: Object.keys(requestBody),
    inputKeys: Object.keys(input),
    hasTrySync: true,
  });

  const requestStart = Date.now();
  const response = await fetch(PRUNA_PREDICTIONS_URL, {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Model': model,
      'Try-Sync': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal,
  });
  const requestElapsed = Date.now() - requestStart;

  generationLogCollector.log(sessionId, TAG, `Response received`, {
    statusCode: response.status,
    statusText: response.statusText,
    requestElapsedMs: requestElapsed,
    ok: response.ok,
  });

  if (!response.ok) {
    const rawBody = await response.text().catch(() => '');
    let errorMessage = `API error: ${response.status}`;
    try {
      const errObj = JSON.parse(rawBody) as Record<string, unknown>;
      errorMessage = String(errObj.message || errObj.detail || errObj.error || rawBody) || errorMessage;
    } catch {
      if (rawBody) errorMessage = rawBody;
    }

    generationLogCollector.error(sessionId, TAG, `Prediction FAILED`, {
      statusCode: response.status,
      statusText: response.statusText,
      errorMessage,
      rawBodyLength: rawBody.length,
    });

    // __DEV__ detailed error logging
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.error(`[DEV] [${TAG}] Prediction FAILED:`, {
        status: response.status,
        statusText: response.statusText,
        errorMessage,
        rawBody: rawBody.substring(0, 500),
        model,
        inputKeys: Object.keys(input),
      });
    }

    const error = new Error(errorMessage);
    (error as Error & { statusCode?: number }).statusCode = response.status;
    throw error;
  }

  const elapsed = Date.now() - startTime;
  const result: PrunaPredictionResponse = await response.json();

  generationLogCollector.log(sessionId, TAG, `Prediction response parsing complete`, {
    elapsedMs: elapsed,
    hasUri: !!extractUri(result),
    hasGetUrl: !!result.get_url,
    hasStatusUrl: !!result.status_url,
    status: result.status,
    hasId: !!result.id,
    responseKeys: Object.keys(result),
  });

  // __DEV__ response logging
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[DEV] [${TAG}] Prediction SUCCESS in ${elapsed}ms:`, {
      hasUri: !!extractUri(result),
      status: result.status,
      responseKeys: Object.keys(result),
      resultId: result.id,
    });
  }

  generationLogCollector.log(sessionId, TAG, `<<< submitPrediction COMPLETE`, {
    totalElapsedMs: elapsed,
    resultStatus: result.status,
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

    // Wait between polls — skip delay on first attempt for faster response
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));

      if (signal?.aborted) {
        throw new Error("Request cancelled by user");
      }
    }

    try {
      const statusRes = await fetch(fullPollUrl, {
        headers: { 'apikey': apiKey },
        signal,
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
    data.video_url ||
    (Array.isArray(data.output) ? data.output[0] : null) ||
    data.data ||
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
