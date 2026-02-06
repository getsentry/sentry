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
  isDefault?: boolean;
}

export function SentryAppAvatar({
  sentryApp,
  isColor = true,
  isDefault = false,
  ...props
}: SentryAppAvatarProps) {
  const avatarDetails = sentryApp?.avatars?.find(({color}) => color === isColor);

  // Render the default if the prop is provided, there is no existing avatar, or it has been reverted to 'default'
  if (isDefault || avatarDetails?.avatarType === 'default') {
    return <FallbackAvatar {...props} />;
  }

  const avatarProps = getSentryAppAvatarProps(sentryApp);

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
  sentryApp: AvatarSentryApp
): UploadBaseAvatarProps | LetterBaseAvatarProps | GravatarBaseAvatarProps | null {
  const identifier = sentryApp.slug;
  const name = sentryApp.name;

  const uploadUrl = sentryApp.avatars?.find(
    ({avatarType}) => avatarType === 'upload'
  )?.avatarUrl;

  // If there is no upload URL, return null and fall
  if (!uploadUrl) return null;

  return {
    type: 'upload',
    uploadUrl,
    identifier,
    name,
  };
}
