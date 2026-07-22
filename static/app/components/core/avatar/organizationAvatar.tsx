import type {Avatar as AvatarType} from 'sentry/types/core';
import {explodeSlug} from 'sentry/utils';

import {
  Avatar,
  type AvatarProps,
  type GravatarBaseAvatarProps,
  type LetterBaseAvatarProps,
  type UploadBaseAvatarProps,
} from './avatar';

interface OrganizationAvatarProps extends AvatarProps {
  organization: {slug: string; avatar?: AvatarType; name?: string};
}

export function OrganizationAvatar({organization, ...props}: OrganizationAvatarProps) {
  return (
    <Avatar
      {...props}
      {...getOrganizationAvatarProps(organization)}
      tooltip={organization.slug}
      title={explodeSlug(organization.slug)}
    />
  );
}

function getOrganizationAvatarProps(
  organization: OrganizationAvatarProps['organization']
): LetterBaseAvatarProps | UploadBaseAvatarProps | GravatarBaseAvatarProps {
  const identifier = organization.slug;
  const name = organization.name || organization.slug || '';

  switch (organization.avatar?.avatarType) {
    case 'letter_avatar':
      return {
        type: 'letter_avatar',
        identifier,
        name,
        title: name,
      };
    case 'upload':
      if (!organization.avatar.avatarUrl) {
        return {
          type: 'letter_avatar',
          identifier,
          name,
          title: name,
        };
      }
      return {
        type: 'upload',
        uploadUrl: organization.avatar.avatarUrl,
        identifier,
        name,
      };
    case 'gravatar':
      if (!organization.avatar.avatarUrl) {
        return {
          type: 'letter_avatar',
          identifier,
          name,
          title: name,
        };
      }
      return {
        type: 'gravatar',
        gravatarId: organization.avatar.avatarUrl,
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
