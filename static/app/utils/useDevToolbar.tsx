import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import DevToolbar from 'sentry/components/devtoolbar';
import {rawTrackAnalyticsEvent} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export default function useDevToolbar({enabled}: {enabled: boolean}) {
  const organization = useOrganization();
  useEffect(() => {
    if (enabled) {
      // TODO: this is insufficient and doesn't take into account control/silo endpoints
      const apiPrefix = window.__SENTRY_DEV_UI ? '/region/us/api/0' : '/api/0';

      const promise = DevToolbar.init({
        rootNode: document.body,
        placement: 'right-edge', // Could also be 'bottom-right-corner'

        // The Settings we need to talk to the Sentry API
        // What org/project/env should we read from?
        SentrySDK: Sentry,
        apiPrefix,
        environment: ['prod'],
        organizationSlug: 'sentry',
        projectId: 11276,
        projectSlug: 'javascript',

        trackAnalytics: (props: {eventKey: string; eventName: string}) =>
          rawTrackAnalyticsEvent({...props, organization}),
      });

      return () => {
        promise.then(cleanup => cleanup());
      };
    }
    return () => {};
  }, [enabled, organization]);
}
