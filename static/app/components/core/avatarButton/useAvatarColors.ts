import {useTheme} from '@emotion/react';
import {skipToken, useQuery} from '@tanstack/react-query';
import color from 'color';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';
import {useAvatar} from '@sentry/scraps/avatar';

import {resolveImageAvatarColors} from './avatarImageAnalysis';

export type AvatarColorsResult =
  | {chonk: string; style: 'padded' | 'fill'; type: 'image'}
  | {chonk: string; type: 'letter'}
  | {type: 'none'};

export function useAvatarColors(avatar?: BaseAvatarProps): AvatarColorsResult {
  const theme = useTheme();
  const avatarDefinition = useAvatar({
    identifier: avatar?.identifier ?? '',
    name: avatar?.name ?? '',
    imageDefinition:
      avatar?.type === 'upload'
        ? {type: 'upload', uploadUrl: avatar.uploadUrl}
        : avatar?.type === 'gravatar'
          ? {type: 'gravatar', gravatarId: avatar.gravatarId}
          : undefined,
  });

  const imageUrl =
    avatarDefinition.type === 'image' ? avatarDefinition.configuration.src : null;

  const {data: imageResult} = useQuery({
    queryKey: ['avatar-button-chonk', imageUrl, theme.type],
    queryFn:
      avatar && imageUrl && avatarDefinition.type === 'image'
        ? () => resolveImageAvatarColors(imageUrl, theme.type)
        : skipToken,
    staleTime: Infinity,
  });

  if (!avatar) {
    return {type: 'none'};
  }

  if (avatarDefinition.type === 'letter') {
    const chonk = color(avatarDefinition.configuration.background).darken(0.65).hex();
    return {type: 'letter', chonk};
  }

  if (imageResult?.chonk) {
    return {type: 'image', chonk: imageResult.chonk, style: imageResult.style};
  }

  return {type: 'none'};
}
