import BaseAvatar from 'app/components/avatar/baseAvatar';
import {IconGeneric} from 'app/icons';
import {SentryApp} from 'app/types';

type Props = {
  sentryApp?: SentryApp;
  isColor?: boolean;
  isDefault?: boolean;
} & BaseAvatar['props'];

const SentryAppAvatar = ({isColor = true, sentryApp, isDefault, ...props}: Props) => {
  const avatarDetails = (sentryApp?.avatars || []).find(({color}) => color === isColor);
  // Render the default if the prop is provided, there is no existing avatar, or it has been reverted to 'default'
  const shouldRenderDefault =
    isDefault || !avatarDetails || avatarDetails.avatarType === 'default';
  return shouldRenderDefault ? (
    <IconGeneric
      size={`${props.size}`}
      className={props.className}
      data-test-id="default-sentry-app-avatar"
    />
  ) : (
    <BaseAvatar
      {...props}
      type="upload"
      uploadPath="sentry-app-avatar"
      uploadId={avatarDetails?.avatarUuid}
      title={sentryApp?.name}
    />
  );
};

export default SentryAppAvatar;
