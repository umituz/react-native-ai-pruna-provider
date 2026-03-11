/**
 * MIME Type Detection Utility
 * Detects file type from binary content using magic byte signatures.
 *
 * Supported formats:
 *   Image: PNG, JPEG, WebP
 *   Audio: MP3 (ID3 + sync word), WAV (RIFF/WAVE), FLAC, M4A/AAC (MP4 ftyp)
 */

import {
  MIME_IMAGE_PNG,
  MIME_IMAGE_JPEG,
  MIME_IMAGE_WEBP,
  MIME_AUDIO_MPEG,
  MIME_AUDIO_WAV,
  MIME_AUDIO_FLAC,
  MIME_AUDIO_MP4,
  MIME_DEFAULT,
} from "./constants/mime.constants";

/**
 * Detect MIME type from raw binary bytes using magic number signatures.
 *
 * Detection order is intentional:
 *   1. JPEG (0xFF 0xD8) — checked before MP3 sync word to avoid false positives
 *   2. PNG  (0x89 0x50)
 *   3. RIFF container → distinguish WAV vs WebP via subformat at offset 8-11
 *   4. MP3 with ID3 tag (0x49 0x44 0x33)
 *   5. MP3 sync word (0xFF 0xE_) — after JPEG to prevent overlap
 *   6. FLAC (fLaC)
 *   7. M4A/AAC (ftyp box at offset 4)
 */
export function detectMimeType(bytes: Uint8Array): string {
  if (bytes.length < 4) return MIME_DEFAULT;

  // ── Image formats ───────────────────────────────────────
  // JPEG: FF D8
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return MIME_IMAGE_JPEG;

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return MIME_IMAGE_PNG;

  // RIFF container — WAV (RIFF....WAVE) or WebP (RIFF....WEBP)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    if (bytes.length > 11) {
      // WAVE at offset 8
      if (bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) return MIME_AUDIO_WAV;
      // WEBP at offset 8
      if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return MIME_IMAGE_WEBP;
    }
    // Unknown RIFF subtype (AVI, AIFF, etc.) or insufficient bytes — don't assume WebP
    return MIME_DEFAULT;
  }

  // ── Audio formats ───────────────────────────────────────
  // MP3 with ID3v2 tag: 49 44 33
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return MIME_AUDIO_MPEG;

  // MP3 frame sync word: FF Ex/Fx (but not FF FF)
  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0 && bytes[1] !== 0xFF) return MIME_AUDIO_MPEG;

  // FLAC: 66 4C 61 43 ("fLaC")
  if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) return MIME_AUDIO_FLAC;

  // M4A / AAC in MP4 container: ftyp box at offset 4
  if (bytes.length > 7 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return MIME_AUDIO_MP4;

  return MIME_DEFAULT;
}
