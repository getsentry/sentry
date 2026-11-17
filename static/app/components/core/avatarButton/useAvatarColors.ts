import {skipToken, useQuery} from '@tanstack/react-query';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';
import {useAvatar} from '@sentry/scraps/avatar';

import type {ImageAnalysis} from './avatarImageAnalysis';
import {resolveImageAvatarColors} from './avatarImageAnalysis';

// `brand` is the color that represents the avatar, or null when it has none
// (a neutral logo, or an image that hasn't been sampled yet) and the UI keeps
// its default styling.
export type AvatarColorsResult =
  | ({type: 'image'} & ImageAnalysis)
  | {brand: string; type: 'letter'}
  | {brand: null; type: 'none'};

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
    return {type: 'none', brand: null};
  }

  if (avatarDefinition.type === 'letter') {
    return {type: 'letter', brand: avatarDefinition.configuration.background};
  }

  if (imageResult) {
    return {type: 'image', ...imageResult};
  }

  return {type: 'none', brand: null};
}
