import type {BaseAvatarProps as GenericAvatarProps} from '@sentry/scraps/avatar';

import type {BaseAvatarProps} from 'sentry/components/avatar';
import {
  getAvatarInitialsOverride,
  useAvatarImageUrl,
} from 'sentry/components/avatar/useAvatar';

export function useResolvedAvatar(
  avatar?: BaseAvatarProps
): GenericAvatarProps | undefined {
  const src = useAvatarImageUrl(
    avatar?.type === 'upload'
      ? {type: 'upload', uploadUrl: avatar.uploadUrl}
      : avatar?.type === 'gravatar'
        ? {type: 'gravatar', gravatarId: avatar.gravatarId}
        : undefined
  );
  if (!avatar) {
    return undefined;
  }
  const {identifier, name, round, suggested} = avatar;
  return {
    identifier,
    name,
    initials: getAvatarInitialsOverride(name),
    round,
    suggested,
    src: src ?? undefined,
  };
}
