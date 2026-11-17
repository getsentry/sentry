import type {BaseAvatarProps} from '@sentry/scraps/avatar';

import {hexToOklch, oklchToHex} from './color';
import {useAvatarColors} from './useAvatarColors';

interface Gradient {
  end: string;
  start: string;
}

/**
 * Darkens `avatarColor` until it is no lighter than `ceiling`, in OKLCH: the
 * hue is kept, and so is the chroma (colorfulness) as far as sRGB can show it
 * at the lower lightness. Darkening in RGB instead would keep the avatar's
 * whitish tint and turn light colors muddy.
 */
function capLightness(avatarColor: string, ceiling: string): string {
  const avatar = hexToOklch(avatarColor);
  const target = hexToOklch(ceiling).l;
  return avatar.l <= target ? avatarColor : oklchToHex({...avatar, l: target});
}

/**
 * A gradient in the avatar's brand color, each stop no lighter than the
 * matching stop of `defaultGradient`, so text that reads on the default
 * gradient still reads on this one. Returns `defaultGradient` while the avatar
 * has no brand color (an image avatar still being sampled, or a neutral logo).
 */
export function useAvatarGradient(
  avatar: BaseAvatarProps | undefined,
  defaultGradient: Gradient
): Gradient {
  const {brand} = useAvatarColors(avatar);
  if (!brand) {
    return defaultGradient;
  }
  return {
    start: capLightness(brand, defaultGradient.start),
    end: capLightness(brand, defaultGradient.end),
  };
}
