import BaseAvatar from 'app/components/avatar/baseAvatar';
import {IconGeneric} from 'app/icons';
import {SentryApp} from 'app/types';

type Props = {
  sentryApp?: SentryApp;
  isDefault?: boolean;
} & BaseAvatar['props'];

const SentryAppAvatar = ({isDefault, ...props}: Props) => {
  return isDefault ? (
    <IconGeneric size={`${props.size}`} className={props.className} />
  ) : (
    <BaseAvatar {...props} />
  );
};

export default SentryAppAvatar;
