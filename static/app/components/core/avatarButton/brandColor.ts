import {isNeutral, meanRgb, rgbToHex, rgbToOklch, saturationOf, type Rgb} from './color';

const BUCKET_SIZE = 24;
const TIE_THRESHOLD = 0.8;

// A logo only gets a brand color when colored pixels make up at least this
// share of it (near-white background excluded). Below that the color is an
// accent, such as a small icon next to a gray wordmark.
const MIN_COLOR_COVERAGE = 0.25;

// ...and when at least this share of its colored pixels sit within
// HUE_TOLERANCE degrees of the dominant hue. Below that it's multicolor.
// Hues are OKLCH, so the tolerance spans a similar visible shift everywhere
// on the wheel (HSV spreads greens wide and squeezes orange into yellow).
const MIN_HUE_AGREEMENT = 0.5;
const HUE_TOLERANCE = 30;

function quantize(v: number): number {
  return Math.round(v / BUCKET_SIZE) * BUCKET_SIZE;
}

// Near-white is usually the plate a logo sits on, not part of the logo.
function isNearWhite([r, g, b]: Rgb): boolean {
  return Math.min(r, g, b) >= 230;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// The most common color among `pixels`, bucketed into coarse RGB buckets.
// Among buckets tied for largest, picks the most saturated one.
function mostCommonColor(pixels: Rgb[]): Rgb {
  const buckets = new Map<string, Rgb[]>();
  for (const pixel of pixels) {
    const key = pixel.map(quantize).join(',');
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(pixel);
    } else {
      buckets.set(key, [pixel]);
    }
  }

  const topCount = Math.max(...Array.from(buckets.values(), bucket => bucket.length));

  let best: Rgb = [0, 0, 0];
  let bestSaturation = -1;
  for (const bucket of buckets.values()) {
    if (bucket.length < topCount * TIE_THRESHOLD) {
      continue;
    }
    const mean = meanRgb(bucket);
    const saturation = saturationOf(mean);
    if (saturation > bestSaturation) {
      best = mean;
      bestSaturation = saturation;
    }
  }
  return best;
}

/**
 * The color that represents a logo, given its opaque pixels, or null when no
 * single color does: the logo is gray, its colored pixels are only a small
 * accent, or they spread over several unrelated hues (e.g. a four-color mark).
 */
export function brandColor(pixels: Rgb[]): string | null {
  const colored = pixels.filter(pixel => !isNeutral(pixel));
  const content = pixels.filter(pixel => !isNearWhite(pixel)).length;
  if (colored.length === 0 || colored.length < content * MIN_COLOR_COVERAGE) {
    return null;
  }

  const dominant = mostCommonColor(colored);
  const hue = rgbToOklch(dominant).h;
  const agreeing = colored.filter(
    pixel => hueDistance(rgbToOklch(pixel).h, hue) <= HUE_TOLERANCE
  ).length;
  return agreeing >= colored.length * MIN_HUE_AGREEMENT ? rgbToHex(dominant) : null;
}
