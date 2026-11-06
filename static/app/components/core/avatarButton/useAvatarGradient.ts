import color from 'color';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';

import {useAvatarColors} from './useAvatarColors';

interface Gradient {
  end: string;
  start: string;
}

// Keeps the avatar's hue and saturation but never gets brighter than
// `ceiling`, so text designed against `ceiling` keeps its contrast.
function getAvatarGradient(avatarColor: string, ceiling: string): Gradient {
  const maxLuminosity = color(ceiling).luminosity();
  let end = color(avatarColor);
  while (end.luminosity() > maxLuminosity && end.lightness() > 0) {
    end = end.lightness(Math.max(end.lightness() - 1, 0));
  }
  const start = end.lightness(Math.max(end.lightness() - 10, 0));
  return {start: start.hex(), end: end.hex()};
}

/**
 * A gradient in the avatar's color. Its end color is never brighter than
 * `defaultGradient.end`, so text that reads on the default gradient still
 * reads on this one. Returns `defaultGradient` while the avatar has no usable
 * color, for example while an image avatar is still being sampled.
 */
export function useAvatarGradient(
  avatar: BaseAvatarProps | undefined,
  defaultGradient: Gradient
): Gradient {
  const avatarColors = useAvatarColors(avatar);
  return avatarColors.type === 'none'
    ? defaultGradient
    : getAvatarGradient(avatarColors.dominant, defaultGradient.end);
}
