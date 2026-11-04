import {
  AvatarButton as GenericAvatarButton,
  type AvatarButtonProps as GenericAvatarButtonProps,
} from '@sentry/scraps/avatarButton';

import type {BaseAvatarProps} from 'sentry/components/avatar';

import {useResolvedAvatar} from './resolveAvatar';
import {useAvatarColors} from './useAvatarColors';

export interface AvatarButtonProps extends Omit<GenericAvatarButtonProps, 'avatar'> {
  avatar?: BaseAvatarProps;
}

export function AvatarButton({avatar, ...props}: AvatarButtonProps) {
  const colors = useAvatarColors(avatar?.suggested ? undefined : avatar);
  return (
    <GenericAvatarButton
      {...props}
      avatar={useResolvedAvatar(avatar)}
      imageAppearance={
        colors.type === 'image'
          ? {borderColor: colors.chonk, padded: colors.style === 'padded'}
          : undefined
      }
    />
  );
}
