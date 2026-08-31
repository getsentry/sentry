import {useTheme, type Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {skipToken, useQuery} from '@tanstack/react-query';
import color from 'color';
import type {DistributedOmit} from 'type-fest';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';
import {ImageAvatar, LetterAvatar, useAvatar} from '@sentry/scraps/avatar';
import {Button, type ButtonProps} from '@sentry/scraps/button';
import {type Responsive, useResponsivePropValue} from '@sentry/scraps/layout';
import {useSizeContext} from '@sentry/scraps/sizeContext';

type AvatarButtonSize = 'xs' | 'sm' | 'md';

interface AvatarButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'variant'> {
  'aria-label': string;
  avatar: BaseAvatarProps;
  size?: Responsive<AvatarButtonSize>;
}

export function AvatarButton({avatar, size: explicitSize, ...props}: AvatarButtonProps) {
  const theme = useTheme();
  const avatarDefinition = useAvatar({
    identifier: avatar.identifier,
    name: avatar.name,
    imageDefinition:
      avatar.type === 'upload'
        ? {type: 'upload', uploadUrl: avatar.uploadUrl}
        : avatar.type === 'gravatar'
          ? {type: 'gravatar', gravatarId: avatar.gravatarId}
          : undefined,
  });

  const imageUrl =
    avatarDefinition.type === 'image' ? avatarDefinition.configuration.src : null;

  const {data: imageResult} = useQuery({
    queryKey: ['avatar-button-chonk', imageUrl, theme.type],
    queryFn:
      imageUrl && avatarDefinition.type === 'image'
        ? () => resolveImageAvatarColors(imageUrl, theme.type)
        : skipToken,
    staleTime: Infinity,
  });

  const contextSize = useSizeContext();
  const size = useResponsivePropValue(explicitSize ?? contextSize ?? 'md');

  if (avatarDefinition.type === 'letter') {
    const avatarChonk = color(avatarDefinition.configuration.background)
      .darken(0.65)
      .hex();

    return (
      <StyledAvatarButton {...props} size={size} chonk={avatarChonk}>
        <AvatarContainer size={size} padded={false} chonk={avatarChonk}>
          <StyledLetterAvatar configuration={avatarDefinition.configuration} />
        </AvatarContainer>
      </StyledAvatarButton>
    );
  }

  return (
    <StyledAvatarButton {...props} size={size} chonk={imageResult?.chonk}>
      <AvatarContainer
        size={size}
        padded={imageResult?.style === 'padded'}
        chonk={imageResult?.chonk}
      >
        <StyledImageAvatar configuration={avatarDefinition.configuration} />
      </AvatarContainer>
    </StyledAvatarButton>
  );
}

const AvatarContainer = styled('div')<{
  size: AvatarButtonSize;
  chonk?: string;
  padded?: boolean;
}>`
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.chonk ?? 'transparent'};
  will-change: transform;
  border-radius: ${p =>
    p.size === 'md'
      ? p.theme.radius.lg
      : p.size === 'sm'
        ? p.theme.radius.md
        : p.size === 'xs'
          ? p.theme.radius.sm
          : p.theme.radius.xs};
  padding: ${p => (p.padded ? p.theme.space.xs : '0')};
  background: ${p => (p.padded ? p.theme.tokens.background.primary : 'transparent')};
  position: relative;
`;

const StyledImageAvatar = styled(ImageAvatar)`
  width: 100%;
  height: 100%;
  border-radius: 0;
  position: relative;
  object-fit: contain;
`;

const StyledLetterAvatar = styled(LetterAvatar)`
  width: 100%;
  height: 100%;
  border-radius: 0;
  position: relative;
`;

// Elevation per size, matching the base button's chonk depth.
const AVATAR_BUTTON_ELEVATION: Record<AvatarButtonSize, string> = {
  md: '2px',
  sm: '2px',
  xs: '1px',
};

type ResolvedAvatarButtonProps = DistributedOmit<ButtonProps, 'size'> & {
  chonk: string | undefined;
  size: AvatarButtonSize;
};

function AvatarButtonBase({chonk: _chonk, ...props}: ResolvedAvatarButtonProps) {
  return <Button {...props} />;
}

const StyledAvatarButton = styled(AvatarButtonBase)`
  padding: 0;
  width: ${p => p.theme.form[p.size].height};
  min-width: ${p => p.theme.form[p.size].height};

  ${p =>
    p.chonk &&
    css`
      &&::before {
        background: ${p.chonk};
        box-shadow: 0 ${AVATAR_BUTTON_ELEVATION[p.size]} 0 0px ${p.chonk};
      }
      &&::after {
        border-color: ${p.chonk};
      }
    `}
`;

// Returns 'fill' when the image covers the full frame edge-to-edge, 'padded' otherwise.
// Each edge check returns 'padded' when every pixel on that edge is transparent (alpha < 128).
// Pixel (col, row) has its alpha channel at (row * 12 + col) * 4 + 3 in a 12×12 RGBA canvas.
/* eslint-disable @typescript-eslint/no-non-null-assertion */
function shouldPadImage(data: Uint8ClampedArray): 'fill' | 'padded' {
  // oxfmt-ignore
  if (!(data[3]!>=128   || data[51]!>=128  || data[99]!>=128  ||
        data[147]!>=128 || data[195]!>=128 || data[243]!>=128 ||
        data[291]!>=128 || data[339]!>=128 || data[387]!>=128 ||
        data[435]!>=128 || data[483]!>=128 || data[531]!>=128)) {return 'padded';}
  // oxfmt-ignore
  if (!(data[47]!>=128  || data[95]!>=128  || data[143]!>=128 ||
        data[191]!>=128 || data[239]!>=128 || data[287]!>=128 ||
        data[335]!>=128 || data[383]!>=128 || data[431]!>=128 ||
        data[479]!>=128 || data[527]!>=128 || data[575]!>=128)) {return 'padded';}
  // oxfmt-ignore
  if (!(data[3]!>=128  || data[7]!>=128  || data[11]!>=128 ||
        data[15]!>=128 || data[19]!>=128 || data[23]!>=128 ||
        data[27]!>=128 || data[31]!>=128 || data[35]!>=128 ||
        data[39]!>=128 || data[43]!>=128 || data[47]!>=128)) {return 'padded';}
  // oxfmt-ignore
  if (!(data[531]!>=128 || data[535]!>=128 || data[539]!>=128 ||
        data[543]!>=128 || data[547]!>=128 || data[551]!>=128 ||
        data[555]!>=128 || data[559]!>=128 || data[563]!>=128 ||
        data[567]!>=128 || data[571]!>=128 || data[575]!>=128)) {return 'padded';}
  if (data[3]! < 128 || data[47]! < 128 || data[531]! < 128 || data[575]! < 128) {
    return 'padded';
  }

  return 'fill';
}
/* eslint-enable @typescript-eslint/no-non-null-assertion */

const SAMPLE_SIZE = 12;

function readPixels(img: HTMLImageElement): Uint8ClampedArray | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    // Draw the image on a 12x12 canvas to make the sampling more efficient
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

// Indices (into the flat RGBA array) of every pixel that sits on the outer
// ring of the SAMPLE_SIZE×SAMPLE_SIZE canvas. Used to sample only the edge
// of full-bleed ('fill') images, since that's the part of the image that
// actually meets the button's border — the center of the image (e.g. a logo
// in the middle of a photo) shouldn't influence the border color.
const EDGE_PIXEL_INDICES = (() => {
  const indices: number[] = [];
  for (let row = 0; row < SAMPLE_SIZE; row++) {
    for (let col = 0; col < SAMPLE_SIZE; col++) {
      if (row === 0 || row === SAMPLE_SIZE - 1 || col === 0 || col === SAMPLE_SIZE - 1) {
        indices.push((row * SAMPLE_SIZE + col) * 4);
      }
    }
  }
  return indices;
})();

// Averages the color of a set of pixels, preferring chromatic pixels
// (saturation ≥ 0.15) over grayscale ones when any are present.
function averagePixels(
  data: Uint8ClampedArray,
  indices: Iterable<number>
): string | null {
  let cr = 0,
    cg = 0,
    cb = 0,
    ccount = 0;
  let ar = 0,
    ag = 0,
    ab = 0,
    acount = 0;

  for (const i of indices) {
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    if (data[i + 3]! < 128) {
      continue;
    }

    const r = data[i]!,
      g = data[i + 1]!,
      b = data[i + 2]!;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */

    ar += r;
    ag += g;
    ab += b;
    acount++;

    if ((Math.max(r, g, b) - Math.min(r, g, b)) / 255 >= 0.15) {
      cr += r;
      cg += g;
      cb += b;
      ccount++;
    }
  }

  const [r, g, b, count] = ccount > 0 ? [cr, cg, cb, ccount] : [ar, ag, ab, acount];
  if (count === 0) {
    return null;
  }

  const toHex = (v: number) =>
    Math.round(v / count)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Finds the dominant color of an inset/padded logo by bucketing pixels into
// coarse RGB buckets, preferring chromatic buckets over grayscale ones when
// present. A simple global average tends to wash out multi-color logos into
// gray, so we look at bucket population instead.
//
// A single largest bucket is a reliable "winner" when one color clearly
// covers more area than the rest (e.g. a logo on a solid-color background).
// But for logos built from several similarly-sized color regions — e.g.
// Slack's four roughly equal quadrants — pixel counts at this sample size
// are dominated by anti-aliasing noise and where quantization bucket edges
// happen to fall, so the "largest" bucket is effectively arbitrary and can
// flip between colors run to run. In that case, prefer the most saturated
// (vibrant) color among the top contenders instead of trusting the noisy
// count — it's both more deterministic and a better border color.
const DOMINANT_BUCKET_SIZE = 24;
// Buckets within this fraction of the top bucket's pixel count are treated
// as tied rather than picking whichever edged out the others by noise.
const DOMINANT_TIE_THRESHOLD = 0.8;

function quantizeChannel(v: number): number {
  return Math.round(v / DOMINANT_BUCKET_SIZE) * DOMINANT_BUCKET_SIZE;
}

function saturationOf(r: number, g: number, b: number): number {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

function dominantColor(data: Uint8ClampedArray): string | null {
  let hasChromatic = false;
  for (let i = 0; i < data.length; i += 4) {
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    if (data[i + 3]! < 128) {
      continue;
    }
    const r = data[i]!,
      g = data[i + 1]!,
      b = data[i + 2]!;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    if (saturationOf(r, g, b) >= 0.15) {
      hasChromatic = true;
      break;
    }
  }

  const buckets = new Map<string, {b: number; count: number; g: number; r: number}>();

  for (let i = 0; i < data.length; i += 4) {
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    if (data[i + 3]! < 128) {
      continue;
    }
    const r = data[i]!,
      g = data[i + 1]!,
      b = data[i + 2]!;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */

    const chromatic = saturationOf(r, g, b) >= 0.15;
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

  // Among the buckets effectively tied for largest, pick the most saturated
  // one rather than whichever happens to have the (noisy) highest count.
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
): {edgeHex: string | null; style: 'fill' | 'padded'; vibrantHex: string | null} | null {
  const data = readPixels(img);
  if (!data) {
    return null;
  }

  const style = shouldPadImage(data);

  // Inset/padded logos have no shared edge with the border, so there's
  // nothing to sample there — only the logo's own dominant color matters.
  return {
    style,
    edgeHex: style === 'fill' ? averagePixels(data, EDGE_PIXEL_INDICES) : null,
    vibrantHex: dominantColor(data),
  };
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Avatar URLs are absolute, built from the `system.url-prefix` option on the
// backend — in local dev that's plain http, but self-uploaded avatars can
// still come back as https (e.g. when url-prefix is configured/cached as
// https, or the option drifts from the page's own scheme). When that happens
// for what is otherwise our own host, the request becomes cross-origin for
// no reason other than a scheme mismatch, and depends on CORS negotiation
// that plain same-origin requests never need. Coerce it back to the page's
// real origin (scheme + host + port) so it's a genuine same-origin request.
// Truly cross-origin URLs (e.g. gravatar.com) are left untouched.
function toPageOriginIfSameHost(url: string): string {
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

async function fetchAvatarColor(
  url: string
): Promise<ReturnType<typeof sampleAvatarColor> | null> {
  // Fetch the image bytes ourselves and draw from an object URL rather than
  // pointing an <img crossorigin="anonymous"> tag directly at `url`. Object
  // URLs are always same-origin for canvas tainting purposes, so once we
  // have the bytes, reading pixel data can never taint the canvas.
  let objectUrl: string | undefined;
  try {
    const response = await fetch(toPageOriginIfSameHost(url), {
      mode: 'cors',
      credentials: 'omit',
      // The avatar endpoint reflects whatever Origin sent the request back
      // as Access-Control-Allow-Origin, but caches the response for a very
      // long time (Cache-Control: max-age=315360000) without varying by
      // Origin. A response already cached from a previous request — e.g. a
      // different dev/CI host, or a plain <img> load that cached it with no
      // CORS headers at all — would get reused here and fail the CORS check
      // even though a fresh request against the same URL would succeed.
      // Bypass the cache so we always get a response with the right header
      // for *our* origin.
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);

    const img = await loadImageElement(objectUrl);
    return img ? sampleAvatarColor(img) : null;
  } catch {
    return null;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

// WCAG 1.4.11 (non-text contrast) recommends a 3:1 minimum for UI components
// like borders against their adjacent content.
const MIN_EDGE_CONTRAST = 3;

// Darkens `hex` until it clears MIN_EDGE_CONTRAST against `edgeHex`, giving up
// (and returning the darkest attempt) after a handful of steps — `hex` and
// `edgeHex` are frequently the same color, and contrast against a fixed
// reference increases monotonically as a color darkens toward black, so this
// always converges rather than needing a fixed, one-size-fits-all amount.
function darkenUntilContrasts(
  hex: string,
  edgeHex: string,
  theme: Theme['type']
): string {
  const edge = color(edgeHex);
  let candidate = color(hex);
  const step = theme === 'dark' ? 0.2 : 0.12;

  for (let i = 0; i < 12 && candidate.contrast(edge) < MIN_EDGE_CONTRAST; i++) {
    candidate = candidate.darken(step);
  }

  return candidate.hex();
}

async function resolveImageAvatarColors(
  url: string,
  theme: Theme['type']
): Promise<{chonk: string | undefined; style: 'fill' | 'padded'} | null> {
  const sampled = await fetchAvatarColor(url);

  if (!sampled) {
    return null;
  }

  // Padded/inset logos sit on their own background within the frame, so the
  // sampled color never touches the button's border directly — use the
  // logo's dominant color as-is rather than darkening it for contrast.
  if (sampled.style === 'padded') {
    return sampled.vibrantHex ? {chonk: sampled.vibrantHex, style: sampled.style} : null;
  }

  // Full-bleed images: prefer the image's own dominant vibrant color (e.g.
  // the bright blue of a jacket) when it already reads clearly against the
  // image's edge. Only fall back to adjusting the edge color itself — e.g.
  // for a smooth gradient, where the "dominant" color is essentially the
  // same as the edge — so the border still looks like it belongs to the
  // image instead of collapsing to a generic dark tone.
  const {edgeHex, vibrantHex} = sampled;
  const base = edgeHex ?? vibrantHex;
  if (!base) {
    return null;
  }

  const chonk =
    vibrantHex &&
    edgeHex &&
    color(vibrantHex).contrast(color(edgeHex)) >= MIN_EDGE_CONTRAST
      ? vibrantHex
      : darkenUntilContrasts(base, base, theme);

  return {
    chonk,
    style: sampled.style,
  };
}
