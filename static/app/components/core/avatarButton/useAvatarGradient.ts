import color from 'color';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';

import {useAvatarColors} from './useAvatarColors';

interface Gradient {
  end: string;
  start: string;
}

type Triple = [number, number, number];

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToChannel(c: number): number {
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
}

// Converts a hex color to OKLab, where lightness is perceptually uniform: two
// colors with the same lightness look equally light whatever their hue.
function hexToOklab(hex: string): Triple {
  const [r = 0, g = 0, b = 0] = color(hex).rgb().array().map(channelToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

// Converts OKLab to linear sRGB. Channels outside 0–1 are out of gamut.
function oklabToLinear([L, a, b]: Triple): Triple {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function isInGamut(linear: Triple): boolean {
  return linear.every(c => c >= -1e-4 && c <= 1 + 1e-4);
}

/**
 * Darkens `avatarColor` until it is no lighter than `ceiling`, in OKLCH: the
 * hue is kept, and so is the chroma (colorfulness) as far as sRGB can show it
 * at the lower lightness. Darkening in RGB instead would keep the avatar's
 * whitish tint and turn light colors muddy.
 */
function capLightness(avatarColor: string, ceiling: string): string {
  const [lightness, a, b] = hexToOklab(avatarColor);
  const [target] = hexToOklab(ceiling);
  if (lightness <= target) {
    return color(avatarColor).hex();
  }

  const chroma = Math.hypot(a, b);
  const hue = Math.atan2(b, a);
  const toLinear = (c: number): Triple =>
    oklabToLinear([target, c * Math.cos(hue), c * Math.sin(hue)]);

  // Find the most chroma, up to the avatar's own, that sRGB can display.
  let low = 0;
  let high = chroma;
  if (!isInGamut(toLinear(high))) {
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      if (isInGamut(toLinear(mid))) {
        low = mid;
      } else {
        high = mid;
      }
    }
    high = low;
  }

  const channels = toLinear(high).map(c => linearToChannel(Math.min(Math.max(c, 0), 1)));
  return color.rgb(channels).hex();
}

// Matches the threshold `dominantColor` uses to tell colored pixels from gray.
const MIN_SATURATION = 0.15;

// Black, white and gray logos sample as a gray, which says nothing about the
// brand and would turn the header black.
function isNeutral(hex: string): boolean {
  const channels = color(hex).rgb().array();
  return (Math.max(...channels) - Math.min(...channels)) / 255 < MIN_SATURATION;
}

/**
 * A gradient in `avatarColor`, each stop no lighter than the matching stop of
 * `defaultGradient`. Neutral (gray) colors keep `defaultGradient`.
 */
function getAvatarGradient(avatarColor: string, defaultGradient: Gradient): Gradient {
  if (isNeutral(avatarColor)) {
    return defaultGradient;
  }
  return {
    start: capLightness(avatarColor, defaultGradient.start),
    end: capLightness(avatarColor, defaultGradient.end),
  };
}

/**
 * A gradient in the avatar's color, each stop no lighter than the matching
 * stop of `defaultGradient`, so text that reads on the default gradient still
 * reads on this one. Returns `defaultGradient` while the avatar has no usable
 * color (an image avatar still being sampled) and for neutral (gray) logos.
 */
export function useAvatarGradient(
  avatar: BaseAvatarProps | undefined,
  defaultGradient: Gradient
): Gradient {
  const avatarColors = useAvatarColors(avatar);
  return avatarColors.type === 'none'
    ? defaultGradient
    : getAvatarGradient(avatarColors.dominant, defaultGradient);
}
