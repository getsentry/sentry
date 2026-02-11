import type React from 'react';

import type {Actor} from 'sentry/types/core';
import type {AvatarUser} from 'sentry/types/user';
import {userDisplayName} from 'sentry/utils/formatters';

import {
  Avatar,
  type AvatarProps,
  type GravatarBaseAvatarProps,
  type LetterBaseAvatarProps,
  type UploadBaseAvatarProps,
} from './avatar';

export interface UserAvatarProps extends AvatarProps {
  user: Actor | AvatarUser;
  renderTooltip?: (user: AvatarUser | Actor) => React.ReactNode;
}

export function UserAvatar({renderTooltip, user, ...props}: UserAvatarProps) {
  return (
    <Avatar
      {...props}
      {...getUserAvatarProps(user)}
      round
      tooltip={
        renderTooltip
          ? renderTooltip(user)
          : props.tooltip
            ? props.tooltip
            : userDisplayName(user)
      }
    />
  );
}

function getUserAvatarProps(
  user: Actor | AvatarUser
): GravatarBaseAvatarProps | LetterBaseAvatarProps | UploadBaseAvatarProps {
  if (isActor(user)) {
    return {
      type: 'letter_avatar',
      identifier: user.name,
      name: user.name,
      title: user.name,
    };
  }

  const identifier = user.email || user.username || user.id || user.ip_address;
  const name = user.name || user.email || user.username || '';

  if (!user.avatar?.avatarType) {
    return {
      type: 'letter_avatar',
      identifier,
      name,
      title: name,
    };
  }

  switch (user.avatar.avatarType) {
    case 'letter_avatar':
      return {
        type: 'letter_avatar',
        identifier,
        name,
        title: name,
      };
    case 'upload':
      if (!user.avatar.avatarUrl) {
        return {
          type: 'letter_avatar',
          identifier,
          name,
          title: name,
        };
      }
      return {
        type: 'upload',
        uploadUrl: user.avatar.avatarUrl,
        identifier,
        name,
      };
    case 'gravatar':
      if (!user.email) {
        return {
          type: 'letter_avatar',
          identifier,
          name,
          title: name,
        };
      }
      return {
        type: 'gravatar',
        gravatarId: user.email.toLowerCase(),
        identifier,
        name,
      };
    default:
      return {
        type: 'letter_avatar',
        identifier,
        name,
        title: name,
      };
  }
}

function isActor(maybe: AvatarUser | Actor): maybe is Actor {
  return typeof (maybe as AvatarUser).email === 'undefined';
}
