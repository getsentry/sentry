import React from 'react';

import Feature from 'sentry/components/acl/feature';
import SentryAppAvatar from 'sentry/components/avatar/sentryAppAvatar';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {AvatarSentryApp} from 'sentry/types';

type Props = {
  size: number;
  sentryApp: AvatarSentryApp;
};

const SentryAppIcon = ({sentryApp, size}: Props) => (
  <Feature features={['organizations:sentry-app-logo-upload']}>
    {({hasFeature}) =>
      hasFeature ? (
        <SentryAppAvatar sentryApp={sentryApp} size={size} isColor />
      ) : (
        <PluginIcon pluginId={sentryApp.slug} size={size} />
      )
    }
  </Feature>
);

export default SentryAppIcon;
