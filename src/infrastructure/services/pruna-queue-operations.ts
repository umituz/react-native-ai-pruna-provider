/**
 * Pruna Queue Operations - Direct Pruna API queue interactions
 * No silent fallbacks - throws descriptive errors on unexpected responses
 */

import type { PrunaModelId } from "../../domain/entities/pruna.types";
import type { JobSubmission, JobStatus } from "../../domain/types";
import { submitPrediction, extractUri } from "./pruna-api-client";
import { buildModelInput } from "./pruna-input-builder";
import { generationLogCollector } from "../utils/log-collector";

const TAG = 'pruna-queue';

/**
 * Submit job to Pruna queue
 * @throws {Error} if prediction fails or response is missing required data
 */
export async function submitJob(
  model: PrunaModelId,
  input: Record<string, unknown>,
  apiKey: string,
  sessionId: string,
): Promise<JobSubmission> {
  generationLogCollector.log(sessionId, TAG, `Submitting job for model: ${model}`);

  const modelInput = await buildModelInput(model, input, apiKey, sessionId);
  const response = await submitPrediction(model, modelInput, apiKey, sessionId);

  // If we got an immediate result, return it with a generated request ID
  const uri = extractUri(response);
  if (uri) {
    const requestId = `pruna_immediate_${Date.now()}`;
    return {
      requestId,
      statusUrl: undefined,
      responseUrl: uri,
    };
  }

  // Async result — return polling URL
  const pollUrl = response.get_url || response.status_url;
  if (!pollUrl) {
    throw new Error(
      `Pruna prediction response missing both result and polling URL for model ${model}.`
    );
  }

  const requestId = `pruna_async_${Date.now()}`;
  return {
    requestId,
    statusUrl: pollUrl,
    responseUrl: undefined,
  };
}

/**
 * Get job status from Pruna polling URL
 * @throws {Error} if polling URL is invalid or response is unexpected
 */
export async function getJobStatus(
  _model: PrunaModelId,
  statusUrl: string,
  apiKey: string,
): Promise<JobStatus> {
  const fullUrl = statusUrl.startsWith('http') ? statusUrl : `https://api.pruna.ai${statusUrl}`;

  const response = await fetch(fullUrl, {
    headers: { 'apikey': apiKey },
  });

  if (!response.ok) {
    throw new Error(`Pruna status check failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  const typedData = data as { status?: string; error?: string };

  if (typedData.status === 'succeeded' || typedData.status === 'completed') {
    return {
      status: "COMPLETED",
      requestId: statusUrl,
    };
  }

  if (typedData.status === 'failed') {
    return {
      status: "FAILED",
      requestId: statusUrl,
    };
  }

  return {
    status: "IN_PROGRESS",
    requestId: statusUrl,
  };
}

/**
 * Get job result from Pruna polling URL
 * @throws {Error} if result is not ready or extraction fails
 */
export async function getJobResult<T = unknown>(
  _model: PrunaModelId,
  statusUrl: string,
  apiKey: string,
): Promise<T> {
  const fullUrl = statusUrl.startsWith('http') ? statusUrl : `https://api.pruna.ai${statusUrl}`;

  const response = await fetch(fullUrl, {
    headers: { 'apikey': apiKey },
  });

  if (!response.ok) {
    throw new Error(`Pruna result fetch failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  const typedData = data as { status?: string; error?: string };

  if (typedData.status === 'failed') {
    throw new Error(typedData.error || "Generation failed.");
  }

  const uri = extractUri(data as Record<string, unknown>);
  if (!uri) {
    throw new Error("Result not ready or extraction failed.");
  }

  const resolvedUri = uri.startsWith('/') ? `https://api.pruna.ai${uri}` : uri;
  return { url: resolvedUri } as T;
}
