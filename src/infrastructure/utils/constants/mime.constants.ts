/**
 * MIME Type Constants
 * Supported media types for Pruna file uploads (images + audio)
 */

// ── Image MIME types ────────────────────────────────────────
export const MIME_IMAGE_PNG = 'image/png' as const;
export const MIME_IMAGE_JPEG = 'image/jpeg' as const;
export const MIME_IMAGE_WEBP = 'image/webp' as const;

// ── Audio MIME types (p-video audio input: flac, mp3, wav) ──
export const MIME_AUDIO_MPEG = 'audio/mpeg' as const;
export const MIME_AUDIO_WAV = 'audio/wav' as const;
export const MIME_AUDIO_FLAC = 'audio/flac' as const;
export const MIME_AUDIO_MP4 = 'audio/mp4' as const;

// ── Fallback ────────────────────────────────────────────────
export const MIME_APPLICATION_OCTET = 'application/octet-stream' as const;
export const MIME_DEFAULT = MIME_APPLICATION_OCTET;

/** Maps MIME type → file extension for upload naming */
export const MIME_TO_EXTENSION: Readonly<Record<string, string>> = {
  [MIME_IMAGE_PNG]: 'png',
  [MIME_IMAGE_JPEG]: 'jpg',
  [MIME_IMAGE_WEBP]: 'webp',
  [MIME_AUDIO_MPEG]: 'mp3',
  [MIME_AUDIO_WAV]: 'wav',
  [MIME_AUDIO_FLAC]: 'flac',
  [MIME_AUDIO_MP4]: 'm4a',
  [MIME_APPLICATION_OCTET]: 'bin',
};

/**
 * Get file extension for a MIME type.
 * Falls back to the subtype (e.g. "png" from "image/png").
 */
export function getExtensionForMime(mime: string): string {
  return MIME_TO_EXTENSION[mime] || mime.split('/')[1] || 'bin';
}
