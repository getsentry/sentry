import color from 'color';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';

import {useAvatarColors} from './useAvatarColors';

interface Gradient {
  end: string;
  start: string;
}

type Rgb = [number, number, number];

function toLinear(hex: string): Rgb {
  return color(hex)
    .rgb()
    .array()
    .map(channel => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as Rgb;
}

function toHex(linear: Rgb): string {
  return color
    .rgb(
      linear.map(c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))
    )
    .hex();
}

// OKLab lightness (0–1). Unlike HSL lightness it is perceptually uniform, so
// two colors with the same value look equally light whatever their hue.
function getLightness([r, g, b]: Rgb): number {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

// Darkens `avatarColor` until it is no lighter than `ceiling`. Scaling linear
// RGB keeps the hue and stays in gamut, and scales OKLab lightness by the cube
// root of the factor, so the factor that lands exactly on `ceiling` is known.
function capLightness(avatarColor: string, ceiling: string): string {
  const linear = toLinear(avatarColor);
  const lightness = getLightness(linear);
  const target = getLightness(toLinear(ceiling));
  if (lightness <= target) {
    return color(avatarColor).hex();
  }
  const factor = (target / lightness) ** 3;
  return toHex(linear.map(c => c * factor) as Rgb);
}

/**
 * A gradient in the avatar's color, each stop no lighter than the matching
 * stop of `defaultGradient`, so text that reads on the default gradient still
 * reads on this one. Returns `defaultGradient` while the avatar has no usable
 * color, for example while an image avatar is still being sampled.
 */
export function useAvatarGradient(
  avatar: BaseAvatarProps | undefined,
  defaultGradient: Gradient
): Gradient {
  const avatarColors = useAvatarColors(avatar);
  if (avatarColors.type === 'none') {
    return defaultGradient;
  }
  return {
    start: capLightness(avatarColors.dominant, defaultGradient.start),
    end: capLightness(avatarColors.dominant, defaultGradient.end),
  };
}
