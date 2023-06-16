import SentryAppAvatar from 'sentry/components/avatar/sentryAppAvatar';
import {AvatarSentryApp} from 'sentry/types';

type Props = {
  sentryApp: AvatarSentryApp;
  size: number;
};

function SentryAppIcon({sentryApp, size}: Props) {
  return <SentryAppAvatar sentryApp={sentryApp} size={size} isColor />;
}

export default SentryAppIcon;
