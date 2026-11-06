import type {BaseAvatarProps} from '@sentry/scraps/avatar';

import {useAvatarColors} from './useAvatarColors';

/**
 * The border color `AvatarButton` derives from an avatar. Pass it as
 * `AvatarButton`'s `borderColor` to match an avatar other than the one shown.
 * Returns `undefined` while the avatar has no usable color, for example while
 * an image avatar is still being sampled.
 */
export function useAvatarButtonBorderColor(avatar?: BaseAvatarProps): string | undefined {
  const colors = useAvatarColors(avatar);
  return colors.type === 'none' ? undefined : colors.chonk;
}
