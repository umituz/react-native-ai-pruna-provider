/**
 * Pruna Draft Mode Utilities
 *
 * Draft mode is a faster, more cost-effective way to generate videos for testing and iteration.
 * - 50% cheaper than normal mode
 * - Faster generation time
 * - Lower quality output (suitable for previews)
 * - Same resolution options (720p, 1080p)
 *
 * When to use draft mode:
 * ✅ Testing prompts and concepts
 * ✅ Iterating on video generation
 * ✅ Previewing before final generation
 * ✅ Longer videos (8+ seconds)
 * ✅ High resolution (1080p)
 *
 * When NOT to use draft mode:
 * ❌ Final production videos
 * ❌ Social media sharing
 * ❌ Client deliverables
 */

import type { PrunaResolution } from "../../domain/entities/pruna.types";
import { DRAFT_MODE_CONFIG, P_VIDEO_PRICING } from "../services/pruna-provider.constants";
import { calculatePercentage } from "./calculation.utils";

/**
 * Validates draft mode parameters for p-video
 *
 * @param params - Parameters to validate
 * @returns Validation result with optional error message
 */
export function validateDraftModeParams(params: {
  duration: number;
  resolution: string;
  draft?: boolean;
}): { valid: boolean; error?: string } {
  const { duration, resolution, draft } = params;

  // Validate duration
  if (typeof duration !== "number" || duration < 1 || duration > 15) {
    return {
      valid: false,
      error: "Duration must be between 1 and 15 seconds",
    };
  }

  // Validate resolution
  const validResolutions: PrunaResolution[] = ["720p", "1080p"];
  if (!validResolutions.includes(resolution as PrunaResolution)) {
    return {
      valid: false,
      error: `Resolution must be one of: ${validResolutions.join(", ")}`,
    };
  }

  // Draft mode is optional and defaults to false
  if (draft !== undefined && typeof draft !== "boolean") {
    return {
      valid: false,
      error: "Draft must be a boolean value",
    };
  }

  return { valid: true };
}

/**
 * Calculates pricing discount for draft mode
 *
 * Draft mode provides 50% discount on normal pricing.
 *
 * @param normalPrice - Normal mode price in USD
 * @param draft - Whether draft mode is enabled
 * @returns Discounted price
 *
 * @example
 * calculateDraftModeDiscount(0.10, true)  // Returns 0.05
 * calculateDraftModeDiscount(0.10, false) // Returns 0.10
 */
export function calculateDraftModeDiscount(
  normalPrice: number,
  draft: boolean,
): number {
  if (!draft) {
    return normalPrice;
  }
  return normalPrice * DRAFT_MODE_CONFIG.discountMultiplier;
}

/**
 * Returns user-friendly description of draft mode
 *
 * @returns Draft mode description
 */
export function getDraftModeDescription(): string {
  return (
    "Draft mode generates videos faster and at 50% cost. " +
    "Quality is lower than normal mode, making it ideal for " +
    "testing prompts and iterating before generating final videos."
  );
}

/**
 * Determines if draft mode is recommended for given parameters
 *
 * Recommends draft mode for:
 * - Longer durations (8+ seconds)
 * - High resolutions (1080p)
 *
 * @param params - Video parameters
 * @returns Whether draft mode is recommended
 *
 * @example
 * recommendDraftMode({ duration: 10, resolution: "1080p" }) // Returns true
 * recommendDraftMode({ duration: 5, resolution: "720p" })   // Returns false
 */
export function recommendDraftMode(params: {
  duration: number;
  resolution: string;
}): boolean {
  const { duration, resolution } = params;

  // Recommend for longer durations
  if (duration >= DRAFT_MODE_CONFIG.maxRecommendDuration) {
    return true;
  }

  // Recommend for high resolutions
  if (resolution === "1080p") {
    return true;
  }

  return false;
}

/**
 * Calculates the cost savings when using draft mode
 *
 * @param duration - Video duration in seconds
 * @param resolution - Video resolution
 * @returns Savings amount in USD
 *
 * @example
 * calculateDraftModeSavings(10, "1080p") // Returns 0.40 (50% off $0.80)
 */
export function calculateDraftModeSavings(
  duration: number,
  resolution: string,
): number {
  const normalPrice = (P_VIDEO_PRICING.normal[resolution as keyof typeof P_VIDEO_PRICING.normal] || 0) * duration;
  const draftPrice = (P_VIDEO_PRICING.draft[resolution as keyof typeof P_VIDEO_PRICING.draft] || 0) * duration;
  return normalPrice - draftPrice;
}

/**
 * Gets pricing information for a given resolution and mode
 *
 * @param resolution - Video resolution
 * @param draft - Whether draft mode is enabled
 * @returns Price per second in USD
 */
export function getPricingPerSecond(
  resolution: string,
  draft: boolean,
): number {
  if (draft) {
    return P_VIDEO_PRICING.draft[resolution as keyof typeof P_VIDEO_PRICING.draft] || 0;
  }
  return P_VIDEO_PRICING.normal[resolution as keyof typeof P_VIDEO_PRICING.normal] || 0;
}

/**
 * Formats price as USD string
 *
 * @param price - Price in USD
 * @returns Formatted price string
 *
 * @example
 * formatPriceUSD(0.05)  // Returns "$0.05"
 * formatPriceUSD(0.10)  // Returns "$0.10"
 */
export function formatPriceUSD(price: number): string {
  return `$${price.toFixed(3)}`;
}

/**
 * Compares draft vs normal mode pricing for a video
 *
 * @param duration - Video duration in seconds
 * @param resolution - Video resolution
 * @returns Comparison object with prices and savings
 *
 * @example
 * compareDraftModePricing(10, "1080p")
 * // Returns:
 * // {
 * //   normalPrice: 0.80,
 * //   draftPrice: 0.40,
 * //   savings: 0.40,
 * //   discountPercent: 50
 * // }
 */
export function compareDraftModePricing(
  duration: number,
  resolution: string,
): {
  normalPrice: number;
  draftPrice: number;
  savings: number;
  discountPercent: number;
} {
  const normalPrice = getPricingPerSecond(resolution, false) * duration;
  const draftPrice = getPricingPerSecond(resolution, true) * duration;
  const savings = normalPrice - draftPrice;
  const discountPercent = calculatePercentage(savings, normalPrice, 0);

  return {
    normalPrice,
    draftPrice,
    savings,
    discountPercent,
  };
}
