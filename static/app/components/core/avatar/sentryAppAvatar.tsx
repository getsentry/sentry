import {IconGeneric} from 'sentry/icons';
import type {AvatarSentryApp} from 'sentry/types/integrations';

import {BaseAvatar, type BaseAvatarProps} from './baseAvatar';

interface SentryAppAvatarProps extends BaseAvatarProps {
  sentryApp: AvatarSentryApp | undefined;
  isColor?: boolean;
  isDefault?: boolean;
  ref?: React.Ref<HTMLSpanElement>;
}

export function SentryAppAvatar({
  ref,
  isColor = true,
  sentryApp,
  isDefault = false,
  ...props
}: SentryAppAvatarProps) {
  const avatarDetails = sentryApp?.avatars?.find(({color}) => color === isColor);

  // Render the default if the prop is provided, there is no existing avatar, or it has been reverted to 'default'
  if (isDefault || avatarDetails?.avatarType === 'default') {
    return <FallbackAvatar {...props} />;
  }

  return (
    <BaseAvatar
      {...props}
      ref={ref}
      type="upload"
      uploadUrl={avatarDetails?.avatarUrl}
      title={sentryApp?.name}
      backupAvatar={props.backupAvatar ?? <FallbackAvatar {...props} />}
    />
  );
}

function FallbackAvatar(props: Pick<BaseAvatarProps, 'size' | 'className'>) {
  return (
    <IconGeneric
      legacySize={`${props.size}`}
      className={props.className}
      data-test-id="default-sentry-app-avatar"
    />
  );
}
