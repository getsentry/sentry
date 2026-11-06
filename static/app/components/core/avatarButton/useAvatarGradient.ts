import color from 'color';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';

import {useAvatarColors} from './useAvatarColors';

type Gradient = readonly [start: string, end: string];

// Keeps the avatar's hue and saturation but never gets brighter than
// `ceiling`, so text designed against `ceiling` keeps its contrast.
function getAvatarGradient(avatarColor: string, ceiling: string): Gradient {
  const maxLuminosity = color(ceiling).luminosity();
  let end = color(avatarColor);
  while (end.luminosity() > maxLuminosity && end.lightness() > 0) {
    end = end.lightness(Math.max(end.lightness() - 1, 0));
  }
  const start = end.lightness(Math.max(end.lightness() - 10, 0));
  return [start.hex(), end.hex()];
}

/**
 * A gradient in the avatar's color, no brighter than `fallback`'s end color.
 * Returns `fallback` when the avatar has no usable color.
 */
export function useAvatarGradient(
  avatar: BaseAvatarProps | undefined,
  fallback: Gradient
): Gradient {
  const avatarColors = useAvatarColors(avatar);
  return avatarColors.type === 'none'
    ? fallback
    : getAvatarGradient(avatarColors.dominant, fallback[1]);
}
