import type {Theme} from '@emotion/react';

import {hexToOklch, oklchToHex} from './oklch';

// Large enough that small logo marks keep their real colors instead of being
// blended with their surroundings by the downscale.
export const SAMPLE_SIZE = 32;

// TS can't prove typed-array index access is defined; this centralizes the
// single suppression so callers stay clean.
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const px = (data: Uint8ClampedArray, i: number): number => data[i]!;

function isOpaqueAt(data: Uint8ClampedArray, col: number, row: number): boolean {
  return px(data, (row * SAMPLE_SIZE + col) * 4 + 3) >= 128;
}

// Returns 'fill' when the image covers the frame edge to edge, 'padded' when an
// edge is fully transparent or a corner is transparent (e.g. a round logo).
export function shouldPadImage(data: Uint8ClampedArray): 'fill' | 'padded' {
  const last = SAMPLE_SIZE - 1;
  const edges: Array<(i: number) => boolean> = [
    i => isOpaqueAt(data, 0, i),
    i => isOpaqueAt(data, last, i),
    i => isOpaqueAt(data, i, 0),
    i => isOpaqueAt(data, i, last),
  ];
  for (const isOpaque of edges) {
    let edgeHasContent = false;
    for (let i = 0; i < SAMPLE_SIZE && !edgeHasContent; i++) {
      edgeHasContent = isOpaque(i);
    }
    if (!edgeHasContent) {
      return 'padded';
    }
  }

  const corners: Array<[number, number]> = [
    [0, 0],
    [last, 0],
    [0, last],
    [last, last],
  ];
  return corners.every(([col, row]) => isOpaqueAt(data, col, row)) ? 'fill' : 'padded';
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
 * the chonk never glows brighter than the button surface. Chroma is lowered to
 * what sRGB can show at that lightness, so dark oranges stay orange-brown (like
 * the warning chonk) instead of clipping to red. Gray colors return undefined
 * and keep the default button chonk.
 *
 * `edge` is the color along the bottom of a full-bleed image, which sits right
 * on top of the chonk. The chonk stays at least MIN_EDGE_STEP darker than it,
 * so an image that darkens toward the bottom doesn't merge into its chonk.
 */
export function getAvatarChonk(
  dominant: string,
  themeType: Theme['type'],
  edge?: string
): string | undefined {
  if (isNeutralColor(dominant)) {
    return undefined;
  }
  const {l, c, h} = hexToOklch(dominant);
  const lightness = themeType === 'dark' ? 0.19 : l - 0.13;
  const chroma = themeType === 'dark' ? Math.min(c, 0.09) : c;
  const ceiling = edge ? hexToOklch(edge).l - MIN_EDGE_STEP : 1;
  return oklchToHex({l: Math.max(0, Math.min(lightness, ceiling)), c: chroma, h});
}

// How much darker (OKLCH lightness) the chonk must be than the bottom edge of a
// full-bleed image for the button's edge to stay visible.
export const MIN_EDGE_STEP = 0.1;

// The average color of the bottom rows of the sample, or null if they're empty.
export function bottomEdgeColor(data: Uint8ClampedArray): string | null {
  const rows = 2;
  const sum: Rgb = [0, 0, 0];
  let count = 0;
  for (let i = (SAMPLE_SIZE - rows) * SAMPLE_SIZE * 4; i < data.length; i += 4) {
    if (px(data, i + 3) < 128) {
      continue;
    }
    sum[0] += px(data, i);
    sum[1] += px(data, i + 1);
    sum[2] += px(data, i + 2);
    count++;
  }
  return count ? toHex([sum[0] / count, sum[1] / count, sum[2] / count]) : null;
}

// A logo only gets tinted when colored pixels make up at least this share of
// it (near-white background excluded). Below that the color is an accent, such
// as a small icon next to a gray wordmark.
const MIN_COLOR_COVERAGE = 0.25;

// ...and when at least this share of its colored pixels sit within
// HUE_TOLERANCE degrees of the dominant hue. Below that it's multicolor.
const MIN_HUE_AGREEMENT = 0.5;
const HUE_TOLERANCE = 30;

type Rgb = [number, number, number];

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

function toHex([r, g, b]: Rgb): string {
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

function sampleAvatarColor(
  img: HTMLImageElement
): {dominant: string; edge: string | null; style: 'fill' | 'padded'} | null {
  const data = readPixels(img);
  if (!data) {
    return null;
  }

  const dominant = dominantColor(data);
  if (!dominant) {
    return null;
  }

  const style = shouldPadImage(data);
  return {dominant, style, edge: style === 'fill' ? bottomEdgeColor(data) : null};
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
