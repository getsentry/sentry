import React from 'react';

import SentryAppAvatar from 'sentry/components/avatar/sentryAppAvatar';
import {AvatarSentryApp} from 'sentry/types';

type Props = {
  size: number;
  sentryApp: AvatarSentryApp;
};

const SentryAppIcon = ({sentryApp, size}: Props) => {
  return <SentryAppAvatar sentryApp={sentryApp} size={size} isColor />;
};

export default SentryAppIcon;
