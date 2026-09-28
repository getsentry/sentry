import {IconGeneric} from 'sentry/icons';
import type {AvatarSentryApp} from 'sentry/types/integrations';

import {
  Avatar,
  type AvatarProps,
  type GravatarBaseAvatarProps,
  type LetterBaseAvatarProps,
  type UploadBaseAvatarProps,
} from './avatar';

interface SentryAppAvatarProps extends AvatarProps {
  sentryApp: AvatarSentryApp;
  isColor?: boolean;
}

export function SentryAppAvatar({
  sentryApp,
  isColor = true,
  ...props
}: SentryAppAvatarProps) {
  const avatarDetails = sentryApp?.avatars?.find(({color}) => color === isColor);

  // Render the default if there is no existing avatar, or it has been reverted to 'default'
  if (avatarDetails?.avatarType === 'default') {
    return <FallbackAvatar {...props} />;
  }

  const avatarProps = getSentryAppAvatarProps(sentryApp, isColor);

  if (!avatarProps) {
    return <FallbackAvatar {...props} />;
  }

  return <Avatar {...props} {...avatarProps} />;
}

function FallbackAvatar(props: Pick<AvatarProps, 'size' | 'className'>) {
  return (
    <IconGeneric
      legacySize={`${props.size}`}
      className={props.className}
      data-test-id="default-sentry-app-avatar"
    />
  );
}

function getSentryAppAvatarProps(
  sentryApp: AvatarSentryApp,
  isColor: boolean
): UploadBaseAvatarProps | LetterBaseAvatarProps | GravatarBaseAvatarProps | null {
  const identifier = sentryApp.slug;
  const name = sentryApp.name;

  const uploadUrl = sentryApp.avatars?.find(
    ({avatarType, color}) => avatarType === 'upload' && color === isColor
  )?.avatarUrl;

  // If there is no upload URL, return null and fall
  if (!uploadUrl) {
    return null;
  }

  return {
    type: 'upload',
    uploadUrl,
    identifier,
    name,
  };
}
