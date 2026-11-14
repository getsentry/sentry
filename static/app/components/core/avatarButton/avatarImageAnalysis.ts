import type {Theme} from '@emotion/react';

export const SAMPLE_SIZE = 12;

// TS can't prove typed-array index access is defined; this centralizes the
// single suppression so callers stay clean.
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const px = (data: Uint8ClampedArray, i: number): number => data[i]!;

// Returns 'fill' when the image covers the full frame edge-to-edge, 'padded' otherwise.
// Each edge check returns 'padded' when every pixel on that edge is transparent (alpha < 128).
// Pixel (col, row) has its alpha channel at (row * 12 + col) * 4 + 3 in a 12×12 RGBA canvas.
export function shouldPadImage(data: Uint8ClampedArray): 'fill' | 'padded' {
  // oxfmt-ignore
  if (!(px(data,3)>=128   || px(data,51)>=128  || px(data,99)>=128  ||
        px(data,147)>=128 || px(data,195)>=128 || px(data,243)>=128 ||
        px(data,291)>=128 || px(data,339)>=128 || px(data,387)>=128 ||
        px(data,435)>=128 || px(data,483)>=128 || px(data,531)>=128)) {return 'padded';}
  // oxfmt-ignore
  if (!(px(data,47)>=128  || px(data,95)>=128  || px(data,143)>=128 ||
        px(data,191)>=128 || px(data,239)>=128 || px(data,287)>=128 ||
        px(data,335)>=128 || px(data,383)>=128 || px(data,431)>=128 ||
        px(data,479)>=128 || px(data,527)>=128 || px(data,575)>=128)) {return 'padded';}
  // oxfmt-ignore
  if (!(px(data,3)>=128  || px(data,7)>=128  || px(data,11)>=128 ||
        px(data,15)>=128 || px(data,19)>=128 || px(data,23)>=128 ||
        px(data,27)>=128 || px(data,31)>=128 || px(data,35)>=128 ||
        px(data,39)>=128 || px(data,43)>=128 || px(data,47)>=128)) {return 'padded';}
  // oxfmt-ignore
  if (!(px(data,531)>=128 || px(data,535)>=128 || px(data,539)>=128 ||
        px(data,543)>=128 || px(data,547)>=128 || px(data,551)>=128 ||
        px(data,555)>=128 || px(data,559)>=128 || px(data,563)>=128 ||
        px(data,567)>=128 || px(data,571)>=128 || px(data,575)>=128)) {return 'padded';}
  if (
    px(data, 3) < 128 ||
    px(data, 47) < 128 ||
    px(data, 531) < 128 ||
    px(data, 575) < 128
  ) {
    return 'padded';
  }

  return 'fill';
}

function readPixels(img: HTMLImageElement): Uint8ClampedArray | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    let drawW = SAMPLE_SIZE;
    let drawH = SAMPLE_SIZE;
    let offsetX = 0;
    let offsetY = 0;
    if (naturalW > 0 && naturalH > 0) {
      const scale = Math.min(SAMPLE_SIZE / naturalW, SAMPLE_SIZE / naturalH);
      drawW = naturalW * scale;
      drawH = naturalH * scale;
      offsetX = (SAMPLE_SIZE - drawW) / 2;
      offsetY = (SAMPLE_SIZE - drawH) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    return ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  } catch {
    return null;
  }
}

// Finds the dominant vibrant color by bucketing pixels into coarse RGB
// buckets, preferring chromatic buckets (saturation ≥ MIN_SATURATION) over grayscale.
// Among tied-for-largest buckets, picks the most saturated one.
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

/**
 * The chonk for an avatar's color, built the way the theme builds the chonks of
 * the accent, danger and warning buttons (compare them in OKLCH): the same hue,
 * one fixed step darker in light mode, and a fixed deep shade in dark mode so
 * the chonk never glows brighter than the button surface. Gray colors return
 * undefined and keep the default button chonk.
 */
export function getAvatarChonk(
  dominant: string,
  themeType: Theme['type']
): string | undefined {
  if (isNeutralColor(dominant)) {
    return undefined;
  }
  return themeType === 'dark'
    ? `oklch(from ${dominant} 0.19 min(c, 0.09) h)`
    : `oklch(from ${dominant} calc(l - 0.13) c h)`;
}

export function dominantColor(data: Uint8ClampedArray): string | null {
  let hasChromatic = false;
  for (let i = 0; i < data.length; i += 4) {
    if (px(data, i + 3) < 128) {
      continue;
    }
    const r = px(data, i),
      g = px(data, i + 1),
      b = px(data, i + 2);
    if (saturationOf(r, g, b) >= MIN_SATURATION) {
      hasChromatic = true;
      break;
    }
  }

  const buckets = new Map<string, {b: number; count: number; g: number; r: number}>();

  for (let i = 0; i < data.length; i += 4) {
    if (px(data, i + 3) < 128) {
      continue;
    }
    const r = px(data, i),
      g = px(data, i + 1),
      b = px(data, i + 2);

    const chromatic = saturationOf(r, g, b) >= MIN_SATURATION;
    if (hasChromatic && !chromatic) {
      continue;
    }

    const key = `${quantizeChannel(r)},${quantizeChannel(g)},${quantizeChannel(b)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count++;
    } else {
      buckets.set(key, {r, g, b, count: 1});
    }
  }

  if (buckets.size === 0) {
    return null;
  }

  let topCount = 0;
  for (const bucket of buckets.values()) {
    topCount = Math.max(topCount, bucket.count);
  }

  let dominant: {b: number; count: number; g: number; r: number} | null = null;
  let dominantSaturation = -1;
  for (const bucket of buckets.values()) {
    if (bucket.count < topCount * DOMINANT_TIE_THRESHOLD) {
      continue;
    }

    const saturation = saturationOf(
      bucket.r / bucket.count,
      bucket.g / bucket.count,
      bucket.b / bucket.count
    );
    if (saturation > dominantSaturation) {
      dominant = bucket;
      dominantSaturation = saturation;
    }
  }

  if (!dominant) {
    return null;
  }

  const {count} = dominant;
  const toHex = (v: number) =>
    Math.round(v / count)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(dominant.r)}${toHex(dominant.g)}${toHex(dominant.b)}`;
}

function sampleAvatarColor(
  img: HTMLImageElement
): {dominant: string; style: 'fill' | 'padded'} | null {
  const data = readPixels(img);
  if (!data) {
    return null;
  }

  const dominant = dominantColor(data);
  if (!dominant) {
    return null;
  }

  return {dominant, style: shouldPadImage(data)};
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    // Allow canvas pixel reads without going through fetch instrumentation,
    // which can add tracing headers and trigger a cross-origin preflight.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Avatar URLs are absolute, built from the `system.url-prefix` option on the
// backend — in local dev that's plain http, but self-uploaded avatars can
// still come back as https. Coerce it back to the page's real origin so it's
// a genuine same-origin request. Truly cross-origin URLs are left untouched.
export function toPageOriginIfSameHost(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    if (
      parsed.hostname === window.location.hostname &&
      parsed.protocol !== window.location.protocol
    ) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function resolveImageAvatarColors(
  url: string
): Promise<ReturnType<typeof sampleAvatarColor>> {
  try {
    const img = await loadImageElement(toPageOriginIfSameHost(url));
    return img ? sampleAvatarColor(img) : null;
  } catch {
    return null;
  }
}
