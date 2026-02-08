import type {Team} from 'sentry/types/organization';
import {explodeSlug} from 'sentry/utils';

import {
  Avatar,
  type AvatarProps,
  type GravatarBaseAvatarProps,
  type LetterBaseAvatarProps,
  type UploadBaseAvatarProps,
} from './avatar';

export interface TeamAvatarProps extends AvatarProps {
  team: Team;
}

export function TeamAvatar({team, tooltip: tooltipProp, ...props}: TeamAvatarProps) {
  const teamAvatarProps = getTeamAvatarProps(team);
  return (
    <Avatar
      {...props}
      {...teamAvatarProps}
      tooltip={tooltipProp ?? `#${explodeSlug(team?.slug ?? '')}`}
    />
  );
}

function getTeamAvatarProps(
  team: Team
): LetterBaseAvatarProps | UploadBaseAvatarProps | GravatarBaseAvatarProps {
  const identifier = team.slug;
  const name = team.name || team.slug;

  if (!team.avatar?.avatarType) {
    return {
      type: 'letter_avatar',
      identifier,
      name,
      title: name,
    };
  }

  switch (team.avatar.avatarType) {
    case 'letter_avatar':
      return {
        type: 'letter_avatar',
        identifier,
        name,
        title: name,
      };
    case 'upload':
      if (!team.avatar.avatarUrl) {
        return {
          type: 'letter_avatar',
          identifier,
          name,
          title: name,
        };
      }
      return {
        type: 'upload',
        uploadUrl: team.avatar.avatarUrl,
        identifier,
        name,
      };
    case 'gravatar':
      if (!team.avatar.avatarUrl) {
        return {
          type: 'letter_avatar',
          identifier,
          name,
          title: name,
        };
      }
      return {
        type: 'gravatar',
        gravatarId: team.avatar.avatarUrl,
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
