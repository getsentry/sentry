// import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {DocIntegration} from 'sentry/types/integrations';

import {
  Avatar,
  type AvatarProps,
  type GravatarBaseAvatarProps,
  type LetterBaseAvatarProps,
  type UploadBaseAvatarProps,
} from './avatar';

interface DocIntegrationAvatarProps extends AvatarProps {
  docIntegration: DocIntegration;
}

export function DocIntegrationAvatar({
  docIntegration,
  ...props
}: DocIntegrationAvatarProps) {
  return <Avatar {...props} {...getDocIntegrationAvatarProps(docIntegration)} />;
}

function getDocIntegrationAvatarProps(
  docIntegration: DocIntegration
): UploadBaseAvatarProps | LetterBaseAvatarProps | GravatarBaseAvatarProps {
  const identifier = docIntegration.slug;
  const name = docIntegration.name;

  if (!docIntegration.avatar?.avatarType) {
    return {
      type: 'letter_avatar',
      identifier,
      name,
      title: name,
    };
  }

  switch (docIntegration.avatar.avatarType) {
    case 'letter_avatar':
      return {
        type: 'letter_avatar',
        identifier,
        name,
        title: name,
      };
    case 'upload':
      if (!docIntegration.avatar.avatarUrl) {
        return {
          type: 'letter_avatar',
          identifier,
          name,
          title: name,
        };
      }
      return {
        type: 'upload',
        uploadUrl: docIntegration.avatar.avatarUrl,
        identifier,
        name,
      };
    case 'gravatar':
      if (!docIntegration.avatar.avatarUrl) {
        return {
          type: 'letter_avatar',
          identifier,
          name,
          title: name,
        };
      }
      return {
        type: 'gravatar',
        gravatarId: docIntegration.avatar.avatarUrl,
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
