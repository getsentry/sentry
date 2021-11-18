import BaseAvatar from 'app/components/avatar/baseAvatar';
import {SentryApp} from 'app/types';

type Props = {
  sentryApp?: SentryApp;
} & BaseAvatar['props'];

const SentryAppAvatar = (props: Props) => {
  return <BaseAvatar {...props} type={props.type} />;
};

export default SentryAppAvatar;
