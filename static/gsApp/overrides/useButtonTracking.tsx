import {useCallback, useLayoutEffect, useRef} from 'react';
import {useMatches} from 'react-router';

import type {TrackingProps} from '@sentry/scraps/trackingContext';

import {useOrganization} from 'sentry/utils/useOrganization';

import {rawTrackAnalyticsEvent} from 'getsentry/utils/rawTrackAnalyticsEvent';
import {convertToReloadPath, getEventPath} from 'getsentry/utils/routeAnalytics';

export function useButtonTracking() {
  const currentOrganization = useOrganization({allowNull: true});
  const currentMatches = useMatches();
  const latest = useRef({matches: currentMatches, organization: currentOrganization});
  useLayoutEffect(() => {
    latest.current = {matches: currentMatches, organization: currentOrganization};
  });

  // Stays stable across navigations so the tracking context doesn't re-render every Button and Link
  return useCallback(
    ({
      clickType,
      analyticsEventName,
      analyticsEventKey,
      analyticsParams,
      'aria-label': ariaLabel,
    }: TrackingProps) => {
      const {matches, organization} = latest.current;
      const hasCustomAnalytics =
        analyticsEventKey !== undefined || analyticsEventName !== undefined;
      const considerSendingAnalytics =
        Boolean(matches) && (Boolean(organization) || hasCustomAnalytics);

      if (considerSendingAnalytics) {
        const routeString = getEventPath(matches);
        const reloadPath = convertToReloadPath(routeString);

        // optional way to override the event name for Reload and Amplitude
        // note null means something different than undefined for eventName so
        // checking for that explicitly
        const eventKey =
          analyticsEventKey === undefined && clickType === 'button'
            ? `button_click.${reloadPath}`
            : analyticsEventKey;
        const eventName = analyticsEventName === undefined ? null : analyticsEventName;

        rawTrackAnalyticsEvent({
          eventKey,
          eventName,
          organization: organization ?? null,
          // pass in the parameterized path as well
          parameterized_path: reloadPath,
          text: ariaLabel,
          ...analyticsParams,
        });
      }
    },
    []
  );
}
