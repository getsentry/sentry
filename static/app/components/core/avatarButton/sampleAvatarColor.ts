/**
 * Samples a representative color from an image element.
 * Returns a CSS hex color string, or null if no suitable color can be derived.
 */
export type AvatarColorSampler = (img: HTMLImageElement) => string | null;

/**
 * Side of the square canvas used for downsampling. Smaller = faster; 16×16
 * gives 256 pixels which is plenty for color estimation.
 */
const SAMPLE_SIZE = 16;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Draws the image scaled down to a SAMPLE_SIZE×SAMPLE_SIZE offscreen canvas
 * and returns its pixel data. Returns null on CORS taint or missing context.
 */
function readPixels(img: HTMLImageElement): Uint8ClampedArray | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    return ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  } catch {
    // Canvas is tainted (cross-origin image without CORS headers)
    return null;
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/**
 * Simple saturation proxy: the range of R/G/B values normalised to [0, 1].
 * A value of 0 is pure gray/white/black; higher values are more chromatic.
 */
function saturation(r: number, g: number, b: number): number {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

// ---------------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------------

/**
 * Simple average of all opaque pixels.
 *
 * Fast, but blends all colors together — colorful images will produce a
 * muddy mid-tone rather than the dominant hue.
 */
export const averageSampler: AvatarColorSampler = img => {
  const data = readPixels(img);
  if (!data) return null;

  let r = 0,
    g = 0,
    b = 0,
    count = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue; // skip transparent pixels
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
    count++;
  }

  if (count === 0) return null;
  return rgbToHex(r / count, g / count, b / count);
};

/**
 * Average of chromatic pixels only (saturation above MIN_SATURATION).
 *
 * Skips near-white, near-black, and near-gray pixels so the result reflects
 * the image's brand color rather than its neutral fill. Returns null when
 * the image has no chromatic pixels (e.g. a grayscale or white logo), which
 * lets the caller fall back to default button styling via the contrast guard.
 */
const MIN_SATURATION = 0.15;

export const saturatedAverageSampler: AvatarColorSampler = img => {
  const data = readPixels(img);
  if (!data) return null;

  let r = 0,
    g = 0,
    b = 0,
    count = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    const pr = data[i]!,
      pg = data[i + 1]!,
      pb = data[i + 2]!;
    if (saturation(pr, pg, pb) < MIN_SATURATION) continue;
    r += pr;
    g += pg;
    b += pb;
    count++;
  }

  if (count === 0) return null;
  return rgbToHex(r / count, g / count, b / count);
};

/**
 * Histogram of coarse color buckets (2 bits per channel → 4×4×4 = 64 buckets).
 *
 * Returns the center of the most-populated bucket, giving the single most
 * common color region rather than a blend. Low-saturation buckets are excluded
 * so that white/gray backgrounds don't dominate.
 */
export const dominantBucketSampler: AvatarColorSampler = img => {
  const data = readPixels(img);
  if (!data) return null;

  // 2 bits per channel: quantize each channel to 0–3 with `>> 6`
  // bucket index = r_q * 16 + g_q * 4 + b_q
  const buckets = new Int32Array(64);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    const pr = data[i]!,
      pg = data[i + 1]!,
      pb = data[i + 2]!;
    if (saturation(pr, pg, pb) < MIN_SATURATION) continue;
    const bucket = ((pr >> 6) << 4) | ((pg >> 6) << 2) | (pb >> 6);
    buckets[bucket]!++;
  }

  let maxCount = 0;
  let maxBucket = -1;
  for (let i = 0; i < 64; i++) {
    if (buckets[i]! > maxCount) {
      maxCount = buckets[i]!;
      maxBucket = i;
    }
  }

  if (maxBucket === -1) return null;

  // Reconstruct the approximate center of the winning bucket
  const rq = (maxBucket >> 4) & 3;
  const gq = (maxBucket >> 2) & 3;
  const bq = maxBucket & 3;

  return rgbToHex(rq * 64 + 32, gq * 64 + 32, bq * 64 + 32);
};
