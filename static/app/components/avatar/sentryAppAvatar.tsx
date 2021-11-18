import BaseAvatar from 'app/components/avatar/baseAvatar';
import {IconGeneric} from 'app/icons';
import {SentryApp} from 'app/types';

type Props = {
  sentryApp?: SentryApp;
  isDefault?: boolean;
} & BaseAvatar['props'];

const SentryAppAvatar = ({isDefault, size, ...props}: Props) => {
  return isDefault ? (
    <IconGeneric size={`${size}`} />
  ) : (
    <BaseAvatar size={size} {...props} />
  );
};

export default SentryAppAvatar;
