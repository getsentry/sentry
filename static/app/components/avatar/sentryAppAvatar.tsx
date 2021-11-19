import BaseAvatar from 'app/components/avatar/baseAvatar';
import {IconGeneric} from 'app/icons';
import {SentryApp} from 'app/types';

type Props = {
  sentryApp?: SentryApp;
  isDefault?: boolean;
  isColor?: boolean;
} & BaseAvatar['props'];

const SentryAppAvatar = ({
  isDefault = false,
  isColor = true,
  sentryApp,
  ...props
}: Props) => {
  const avatarDetails = (sentryApp?.avatars || []).find(({color}) => color === isColor);
  return isDefault || !avatarDetails ? (
    <IconGeneric size={`${props.size}`} className={props.className} />
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
