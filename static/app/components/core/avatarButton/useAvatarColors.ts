import {skipToken, useQuery} from '@tanstack/react-query';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';
import {useAvatar} from '@sentry/scraps/avatar';

import {resolveImageAvatarColors} from './avatarImageAnalysis';

// `dominant` is the color the avatar shows. `style` says whether an image fills
// the frame or should be inset.
export type AvatarColorsResult =
  | {dominant: string; style: 'padded' | 'fill'; type: 'image'}
  | {dominant: string; type: 'letter'}
  | {type: 'none'};

export function useAvatarColors(avatar?: BaseAvatarProps): AvatarColorsResult {
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
    queryKey: ['avatar-image-analysis', imageUrl],
    queryFn:
      avatar && imageUrl && avatarDefinition.type === 'image'
        ? () => resolveImageAvatarColors(imageUrl)
        : skipToken,
    staleTime: Infinity,
  });

  if (!avatar) {
    return {type: 'none'};
  }

  if (avatarDefinition.type === 'letter') {
    return {type: 'letter', dominant: avatarDefinition.configuration.background};
  }

  if (imageResult) {
    return {type: 'image', dominant: imageResult.dominant, style: imageResult.style};
  }

  return {type: 'none'};
}
