import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import DevToolbar from 'sentry/components/devtoolbar';
import {rawTrackAnalyticsEvent} from 'sentry/utils/analytics';
import FeatureFlagOverrides from 'sentry/utils/featureFlagOverrides';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

export default function useDevToolbar({enabled}: {enabled: boolean}) {
  const organization = useOrganization();
  const {email} = useUser();

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
        projectPlatform: 'javascript',
        projectSlug: 'javascript',
        featureFlags: {
          getFeatureFlagMap: () =>
            FeatureFlagOverrides.singleton().getFeatureFlagMap(organization),
          urlTemplate: flag =>
            `https://github.com/search?q=repo%3Agetsentry%2Fsentry-options-automator+OR+repo%3Agetsentry%2Fsentry+${flag}&type=code`,
          setOverrideValue: (name, value) => {
            // only boolean flags in sentry
            if (typeof value === 'boolean') {
              FeatureFlagOverrides.singleton().setStoredOverride(name, value);
            }
          },
          clearOverrides: () => {
            FeatureFlagOverrides.singleton().clear();
          },
        },
        trackAnalytics: (props: {eventKey: string; eventName: string}) =>
          rawTrackAnalyticsEvent({...props, email, organization}),
      });

      return () => {
        promise.then(cleanup => cleanup());
      };
    }
    return () => {};
  }, [email, enabled, organization]);
}
