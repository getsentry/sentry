import BaseAvatar from 'sentry/components/avatar/baseAvatar';
import {IconGeneric} from 'sentry/icons';
import type {AvatarSentryApp} from 'sentry/types';

type Props = {
  isColor?: boolean;
  isDefault?: boolean;
  sentryApp?: AvatarSentryApp;
} & BaseAvatar['props'];

const SentryAppAvatar = ({isColor = true, sentryApp, isDefault, ...props}: Props) => {
  const avatarDetails = sentryApp?.avatars?.find(({color}) => color === isColor);
  const defaultSentryAppAvatar = (
    <IconGeneric
      size={`${props.size}`}
      className={props.className}
      data-test-id="default-sentry-app-avatar"
    />
  );
  // Render the default if the prop is provided, there is no existing avatar, or it has been reverted to 'default'
  if (isDefault || !avatarDetails || avatarDetails.avatarType === 'default') {
    return defaultSentryAppAvatar;
  }
  return (
    <BaseAvatar
      {...props}
      type="upload"
      uploadPath="sentry-app-avatar"
      uploadId={avatarDetails?.avatarUuid}
      title={sentryApp?.name}
      backupAvatar={defaultSentryAppAvatar}
    />
  );
};

export default SentryAppAvatar;
