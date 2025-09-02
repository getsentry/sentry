import type React from 'react';

import type {Actor} from 'sentry/types/core';
import type {AvatarUser} from 'sentry/types/user';
import {userDisplayName} from 'sentry/utils/formatters';

import {BaseAvatar, type BaseAvatarProps} from './baseAvatar';

export interface UserAvatarProps extends BaseAvatarProps {
  user: Actor | AvatarUser | undefined;
  gravatar?: boolean;
  ref?: React.Ref<HTMLSpanElement | SVGSVGElement | HTMLImageElement>;
  renderTooltip?: (user: AvatarUser | Actor) => React.ReactNode;
}

export function UserAvatar({
  ref,

  // Default gravatar to false in order to support transparent avatars
  // Avatar falls through to letter avatars if a remote image fails to load,
  // however gravatar sends back a transparent image when it does not find a gravatar,
  // so there's little we have to control whether we need to fallback to letter avatar
  gravatar = false,

  renderTooltip,
  user,
  ...props
}: UserAvatarProps) {
  if (!user) {
    // @TODO(jonasbadalic): Do we need a placeholder here?
    return null;
  }

  const type = inferAvatarType(user, gravatar);
  let tooltip: React.ReactNode = null;

  if (renderTooltip) {
    tooltip = renderTooltip(user);
  } else if (props.tooltip) {
    tooltip = props.tooltip;
  } else {
    tooltip = userDisplayName(user);
  }

  return (
    <BaseAvatar
      round
      ref={ref}
      type={type}
      tooltip={tooltip}
      {...props}
      {...getAvatarProps(user)}
    />
  );
}

function getAvatarProps(user: AvatarUser | Actor) {
  return isActor(user)
    ? {
        gravatarId: '',
        letterId: user.name,
        title: user.name,
        uploadUrl: '',
      }
    : {
        uploadUrl: user.avatar?.avatarUrl ?? '',
        gravatarId: user.email?.toLowerCase(),
        letterId: user.email || user.username || user.id || user.ip_address,
        title: user.name || user.email || user.username || '',
      };
}

function isActor(maybe: AvatarUser | Actor): maybe is Actor {
  return typeof (maybe as AvatarUser).email === 'undefined';
}

function inferAvatarType(user: AvatarUser | Actor, gravatar: boolean | undefined) {
  if (isActor(user)) {
    return 'letter_avatar';
  }
  if (user.avatar) {
    return user.avatar.avatarType;
  }
  if (user.options?.avatarType) {
    return user.options.avatarType;
  }

  return user.email && gravatar ? 'gravatar' : 'letter_avatar';
}
