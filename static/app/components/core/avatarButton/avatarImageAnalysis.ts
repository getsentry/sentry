import {meanRgb, rgbToHex, type Rgb} from './color';
import {tintColor} from './tintColor';

// Large enough that small logo marks keep their real colors instead of being
// blended with their surroundings by the downscale.
export const SAMPLE_SIZE = 32;

// How many rows along the bottom of a full-bleed image meet the chonk.
const EDGE_ROWS = 2;

// TS can't prove typed-array index access is defined; this centralizes the
// single suppression so callers stay clean.
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const px = (data: Uint8ClampedArray, i: number): number => data[i]!;

function isOpaqueAt(data: Uint8ClampedArray, col: number, row: number): boolean {
  return px(data, (row * SAMPLE_SIZE + col) * 4 + 3) >= 128;
}

/** The RGB channels of every opaque pixel in RGBA `data`. */
export function opaquePixels(data: Uint8ClampedArray): Rgb[] {
  const pixels: Rgb[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (px(data, i + 3) >= 128) {
      pixels.push([px(data, i), px(data, i + 1), px(data, i + 2)]);
    }
  }
  return pixels;
}

// Whether the image covers the frame edge to edge. It doesn't when an edge is
// fully transparent or a corner is transparent (e.g. a round logo).
function coversFrame(data: Uint8ClampedArray): boolean {
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
      return false;
    }
  }

  const corners: Array<[number, number]> = [
    [0, 0],
    [last, 0],
    [0, last],
    [last, last],
  ];
  return corners.every(([col, row]) => isOpaqueAt(data, col, row));
}

// The average color of the bottom rows of the sample, or null if they're empty.
export function bottomEdgeColor(data: Uint8ClampedArray): string | null {
  const pixels = opaquePixels(data.subarray((SAMPLE_SIZE - EDGE_ROWS) * SAMPLE_SIZE * 4));
  return pixels.length ? rgbToHex(meanRgb(pixels)) : null;
}

/**
 * How the image sits in the button. A 'fill' image covers the frame and its
 * `edge` (the color along its bottom) sits right on top of the chonk; a
 * 'padded' image is inset instead.
 */
export type ImageLayout = {style: 'padded'} | {edge: string; style: 'fill'};

export function imageLayout(data: Uint8ClampedArray): ImageLayout {
  if (!coversFrame(data)) {
    return {style: 'padded'};
  }
  // Opaque bottom corners mean the bottom rows always have pixels to average.
  const edge = bottomEdgeColor(data);
  return edge ? {style: 'fill', edge} : {style: 'padded'};
}

/** The image's layout, plus its tint (null for neutral logos). */
export type ImageAnalysis = ImageLayout & {tint: string | null};

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

function analyzeImage(img: HTMLImageElement): ImageAnalysis | null {
  const data = readPixels(img);
  if (!data) {
    return null;
  }

  const pixels = opaquePixels(data);
  if (pixels.length === 0) {
    return null;
  }

  return {tint: tintColor(pixels), ...imageLayout(data)};
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
): Promise<ImageAnalysis | null> {
  try {
    const img = await loadImageElement(toPageOriginIfSameHost(url));
    return img ? analyzeImage(img) : null;
  } catch {
    return null;
  }
}
