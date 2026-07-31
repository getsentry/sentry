import {useMatches} from 'react-router-dom';

import type {TrackingProps} from '@sentry/scraps/trackingContext';

import {useOrganization} from 'sentry/utils/useOrganization';

import {rawTrackAnalyticsEvent} from 'getsentry/utils/rawTrackAnalyticsEvent';
import {convertToReloadPath, getEventPath} from 'getsentry/utils/routeAnalytics';

export function useButtonTracking() {
  const organization = useOrganization({allowNull: true});
  const matches = useMatches();

  return ({
    clickType,
    analyticsEventName,
    analyticsEventKey,
    analyticsParams,
    'aria-label': ariaLabel,
  }: TrackingProps) => {
    const considerSendingAnalytics = organization && Boolean(matches);

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
        organization,
        // pass in the parameterized path as well
        parameterized_path: reloadPath,
        text: ariaLabel,
        ...analyticsParams,
      });
    }
  };
}
