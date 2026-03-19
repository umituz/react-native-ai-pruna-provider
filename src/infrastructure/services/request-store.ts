/**
 * Request Store - Promise Deduplication with globalThis
 * Survives hot reloads for React Native development
 *
 * React Native is single-threaded - no lock mechanism needed.
 * Direct Map operations are atomic in JS event loop.
 */

export interface ActiveRequest<T = unknown> {
  promise: Promise<T>;
  abortController: AbortController;
  createdAt: number;
}

const STORE_KEY = "__PRUNA_PROVIDER_REQUESTS__";
const TIMER_KEY = "__PRUNA_PROVIDER_CLEANUP_TIMER__";
const REQUEST_ID_KEY = "__PRUNA_PROVIDER_REQUEST_IDS__";
const REQUEST_KEY_CACHE_KEY = "__PRUNA_PROVIDER_KEY_CACHE__";
type RequestStore = Map<string, ActiveRequest>;
type RequestIdMap = Map<string, { statusUrl?: string; responseUrl?: string; model: string }>;

const CLEANUP_INTERVAL = 60_000;
const MAX_REQUEST_AGE = 3_660_000; // 61 min — must exceed max allowed timeout (1 hour)

// Request key cache for performance optimization
interface CacheEntry {
  key: string;
  timestamp: number;
}
type RequestKeyCache = Map<string, CacheEntry>;
const MAX_CACHE_SIZE = 100;
const CACHE_TTL = 300_000; // 5 minutes

function getCleanupTimer(): ReturnType<typeof setInterval> | null {
  const globalObj = globalThis as Record<string, unknown>;
  return (globalObj[TIMER_KEY] as ReturnType<typeof setInterval>) ?? null;
}

function setCleanupTimer(timer: ReturnType<typeof setInterval> | null): void {
  const globalObj = globalThis as Record<string, unknown>;
  globalObj[TIMER_KEY] = timer;
}

export function getRequestStore(): RequestStore {
  const globalObj = globalThis as Record<string, unknown>;
  if (!globalObj[STORE_KEY]) {
    globalObj[STORE_KEY] = new Map();
  }
  return globalObj[STORE_KEY] as RequestStore;
}

function getRequestKeyCache(): RequestKeyCache {
  const globalObj = globalThis as Record<string, unknown>;
  if (!globalObj[REQUEST_KEY_CACHE_KEY]) {
    globalObj[REQUEST_KEY_CACHE_KEY] = new Map();
  }
  return globalObj[REQUEST_KEY_CACHE_KEY] as RequestKeyCache;
}

function generateCacheKey(model: string, input: Record<string, unknown>): string {
  // Fast deterministic hash using sorted property names
  // Much faster than deep object sorting + JSON.stringify
  const keys = Object.keys(input).sort();
  let hash = model;
  for (const key of keys) {
    const value = input[key];
    hash += `|${key}:${typeof value === 'object' ? JSON.stringify(value) : String(value)}`;
  }
  return hash;
}

export function createRequestKey(model: string, input: Record<string, unknown>): string {
  const cacheKey = generateCacheKey(model, input);
  const cache = getRequestKeyCache();
  const now = Date.now();

  // Check cache with TTL validation
  const cached = cache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.key;
  }

  // Cache miss or expired - generate new key using simple hash
  // Use timestamp + random suffix for uniqueness (crypto-friendly)
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const requestKey = `${model}_${cacheKey.substring(0, 16)}_${timestamp}_${randomSuffix}`;

  // Store in cache with LRU eviction
  cache.set(cacheKey, { key: requestKey, timestamp: now });

  // Evict oldest entry if cache is too large
  if (cache.size > MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }

  return requestKey;
}

export function getExistingRequest<T>(key: string): ActiveRequest<T> | undefined {
  return getRequestStore().get(key) as ActiveRequest<T> | undefined;
}

export function storeRequest<T>(key: string, request: ActiveRequest<T>): void {
  getRequestStore().set(key, request);
  ensureCleanupRunning();
}

export function removeRequest(key: string): void {
  getRequestStore().delete(key);
}

export function cancelRequest(key: string): void {
  const store = getRequestStore();
  const req = store.get(key);
  if (req) {
    req.abortController.abort();
    store.delete(key);
    if (store.size === 0) stopCleanupTimer();
  }
}

export function cancelAllRequests(): void {
  const store = getRequestStore();
  store.forEach((req) => {
    req.abortController.abort();
  });
  store.clear();
  stopCleanupTimer();
}

export function hasActiveRequests(): boolean {
  return getRequestStore().size > 0;
}

export function cleanupRequestStore(maxAge: number = MAX_REQUEST_AGE): number {
  const store = getRequestStore();
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, request] of store.entries()) {
    if (now - request.createdAt > maxAge) {
      request.abortController.abort();
      store.delete(key);
      cleanedCount++;
    }
  }

  if (store.size === 0) {
    stopCleanupTimer();
  }

  // Also cleanup orphaned requestId mappings
  cleanupRequestIdMappings(maxAge);

  return cleanedCount;
}

function ensureCleanupRunning(): void {
  if (getCleanupTimer()) return;

  const timer = setInterval(() => {
    cleanupRequestStore(MAX_REQUEST_AGE);
  }, CLEANUP_INTERVAL);

  setCleanupTimer(timer);
}

function stopCleanupTimer(): void {
  const timer = getCleanupTimer();
  if (timer) {
    clearInterval(timer);
    setCleanupTimer(null);
  }
}

export function stopAutomaticCleanup(): void {
  stopCleanupTimer();
}

// ─── Request ID to StatusUrl Mapping ───────────────────────────────────────

function getRequestIdMap(): RequestIdMap {
  const globalObj = globalThis as Record<string, unknown>;
  if (!globalObj[REQUEST_ID_KEY]) {
    globalObj[REQUEST_ID_KEY] = new Map();
  }
  return globalObj[REQUEST_ID_KEY] as RequestIdMap;
}

export function storeRequestIdMapping(requestId: string, statusUrl: string, model: string): void {
  getRequestIdMap().set(requestId, { statusUrl, model, responseUrl: undefined });
}

export function storeImmediateResultMapping(requestId: string, responseUrl: string, model: string): void {
  getRequestIdMap().set(requestId, { statusUrl: undefined, model, responseUrl });
}

export function getStatusUrlForRequestId(requestId: string): string | undefined {
  const mapping = getRequestIdMap().get(requestId);
  return mapping?.statusUrl;
}

export function getResponseUrlForRequestId(requestId: string): string | undefined {
  const mapping = getRequestIdMap().get(requestId);
  return mapping?.responseUrl;
}

export function removeRequestIdMapping(requestId: string): void {
  getRequestIdMap().delete(requestId);
}

/** Cleanup old requestId mappings to prevent unbounded memory growth */
export function cleanupRequestIdMappings(maxAge: number = MAX_REQUEST_AGE): number {
  const requestStore = getRequestStore();
  const requestIdMap = getRequestIdMap();
  const now = Date.now();
  let cleanedCount = 0;

  // Remove mappings for requests that no longer exist or are too old
  for (const [requestId] of requestIdMap.entries()) {
    const request = requestStore.get(requestId);
    if (!request || (now - request.createdAt > maxAge)) {
      requestIdMap.delete(requestId);
      cleanedCount++;
    }
  }

  return cleanedCount;
}

// Clear any leftover timer on module load (hot reload safety)
if (typeof globalThis !== "undefined") {
  const existingTimer = getCleanupTimer();
  if (existingTimer) {
    clearInterval(existingTimer);
    setCleanupTimer(null);
  }
}
