import {dominantColor, px, toHex, type Rgb} from './dominantColor';

// Large enough that small logo marks keep their real colors instead of being
// blended with their surroundings by the downscale.
export const SAMPLE_SIZE = 32;

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
