// TS can't prove typed-array index access is defined; this centralizes the
// single suppression so callers stay clean.
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const px = (data: Uint8ClampedArray, i: number): number => data[i]!;

const DOMINANT_BUCKET_SIZE = 24;
const DOMINANT_TIE_THRESHOLD = 0.8;

function quantizeChannel(v: number): number {
  return Math.round(v / DOMINANT_BUCKET_SIZE) * DOMINANT_BUCKET_SIZE;
}

function saturationOf(r: number, g: number, b: number): number {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

// Below this saturation a pixel counts as gray rather than colored.
const MIN_SATURATION = 0.15;

/**
 * Black, white and gray colors say nothing about the avatar's brand, so they
 * keep the default styling instead of tinting the UI.
 */
export function isNeutralColor(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return saturationOf((n >> 16) & 255, (n >> 8) & 255, n & 255) < MIN_SATURATION;
}

// A logo only gets tinted when colored pixels make up at least this share of
// it (near-white background excluded). Below that the color is an accent, such
// as a small icon next to a gray wordmark.
const MIN_COLOR_COVERAGE = 0.25;

// ...and when at least this share of its colored pixels sit within
// HUE_TOLERANCE degrees of the dominant hue. Below that it's multicolor.
const MIN_HUE_AGREEMENT = 0.5;
const HUE_TOLERANCE = 30;

export type Rgb = [number, number, number];

function hueOf([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) {
    return 0;
  }
  const h =
    max === r
      ? ((g - b) / delta) % 6
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  return (h * 60 + 360) % 360;
}

function isNearWhite([r, g, b]: Rgb): boolean {
  return Math.min(r, g, b) >= 230;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

// The most common color among `pixels`, bucketed into coarse RGB buckets.
// Among buckets tied for largest, picks the most saturated one.
function mostCommonColor(pixels: Rgb[]): Rgb {
  const buckets = new Map<string, {count: number; sum: Rgb}>();
  for (const [r, g, b] of pixels) {
    const key = `${quantizeChannel(r)},${quantizeChannel(g)},${quantizeChannel(b)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.sum[0] += r;
      bucket.sum[1] += g;
      bucket.sum[2] += b;
      bucket.count++;
    } else {
      buckets.set(key, {count: 1, sum: [r, g, b]});
    }
  }

  let topCount = 0;
  for (const bucket of buckets.values()) {
    topCount = Math.max(topCount, bucket.count);
  }

  let best: Rgb = [0, 0, 0];
  let bestSaturation = -1;
  for (const {count, sum} of buckets.values()) {
    if (count < topCount * DOMINANT_TIE_THRESHOLD) {
      continue;
    }
    const mean: Rgb = [sum[0] / count, sum[1] / count, sum[2] / count];
    const saturation = saturationOf(...mean);
    if (saturation > bestSaturation) {
      best = mean;
      bestSaturation = saturation;
    }
  }
  return best;
}

/**
 * The avatar's brand color, or a gray when it has none. Grays mean "keep the
 * default styling" (see `isNeutralColor`). A logo is neutral when its colored
 * pixels are only a small accent, or when they spread over several unrelated
 * hues (e.g. a four-color mark) so no single color represents it.
 */
export function dominantColor(data: Uint8ClampedArray): string | null {
  const colored: Rgb[] = [];
  const gray: Rgb[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (px(data, i + 3) < 128) {
      continue;
    }
    const pixel: Rgb = [px(data, i), px(data, i + 1), px(data, i + 2)];
    (saturationOf(...pixel) >= MIN_SATURATION ? colored : gray).push(pixel);
  }

  if (colored.length + gray.length === 0) {
    return null;
  }

  // Near-white is usually the plate a logo sits on, not part of the logo.
  const content = colored.length + gray.filter(pixel => !isNearWhite(pixel)).length;
  if (colored.length > 0 && colored.length >= content * MIN_COLOR_COVERAGE) {
    const dominant = mostCommonColor(colored);
    const hue = hueOf(dominant);
    const agreeing = colored.filter(
      pixel => hueDistance(hueOf(pixel), hue) <= HUE_TOLERANCE
    ).length;
    if (agreeing >= colored.length * MIN_HUE_AGREEMENT) {
      return toHex(dominant);
    }
  }

  if (gray.length > 0) {
    return toHex(mostCommonColor(gray));
  }

  // Entirely multicolor: fall back to the overall lightness as a gray.
  const luma =
    colored.reduce((sum, [r, g, b]) => sum + 0.299 * r + 0.587 * g + 0.114 * b, 0) /
    colored.length;
  return toHex([luma, luma, luma]);
}
