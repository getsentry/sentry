import {forwardRef} from 'react';

import {BaseAvatar, type BaseAvatarProps} from 'sentry/components/core/avatar/baseAvatar';
import {IconGeneric} from 'sentry/icons';
import type {AvatarSentryApp} from 'sentry/types/integrations';

export interface SentryAppAvatarProps extends BaseAvatarProps {
  isColor?: boolean;
  isDefault?: boolean;
  sentryApp?: AvatarSentryApp;
}

export const SentryAppAvatar = forwardRef<HTMLSpanElement, SentryAppAvatarProps>(
  ({isColor = true, sentryApp, isDefault = false, ...props}, ref) => {
    const avatarDetails = sentryApp?.avatars?.find(({color}) => color === isColor);

    // Render the default if the prop is provided, there is no existing avatar, or it has been reverted to 'default'
    if (isDefault || !avatarDetails || avatarDetails.avatarType === 'default') {
      return <AppAvatarFallback {...props} />;
    }

    return (
      <BaseAvatar
        {...props}
        ref={ref}
        type="upload"
        uploadUrl={avatarDetails?.avatarUrl}
        title={sentryApp?.name}
        backupAvatar={<AppAvatarFallback {...props} />}
      />
    );
  }
);

function AppAvatarFallback(props: Pick<BaseAvatarProps, 'size' | 'className'>) {
  return (
    <IconGeneric
      legacySize={`${props.size}`}
      className={props.className}
      data-test-id="default-sentry-app-avatar"
    />
  );
}
