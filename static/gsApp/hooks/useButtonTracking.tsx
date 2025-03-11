import {useCallback, useContext} from 'react';

import type {ButtonProps} from 'sentry/components/button';
import {useRoutes} from 'sentry/utils/useRoutes';
import {OrganizationContext} from 'sentry/views/organizationContext';

import rawTrackAnalyticsEvent from 'getsentry/utils/rawTrackAnalyticsEvent';
import {convertToReloadPath, getEventPath} from 'getsentry/utils/routeAnalytics';

type Props = ButtonProps;

export default function useButtonTracking({
  analyticsEventName,
  analyticsEventKey,
  analyticsParams,
  'aria-label': ariaLabel,
}: Props) {
  const organization = useContext(OrganizationContext);
  const routes = useRoutes();

  const trackButton = useCallback(() => {
    const considerSendingAnalytics = organization && routes;

    if (considerSendingAnalytics) {
      const routeString = getEventPath(routes);
      const reloadPath = convertToReloadPath(routeString);

      // optional way to override the event name for Reload and Amplitude
      // note null means something different than undefined for eventName so
      // checking for that explicitly
      const eventKey =
        analyticsEventKey !== undefined
          ? analyticsEventKey
          : `button_click.${reloadPath}`;
      const eventName = analyticsEventName !== undefined ? analyticsEventName : null;

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
  }, [
    analyticsEventKey,
    analyticsEventName,
    analyticsParams,
    ariaLabel,
    organization,
    routes,
  ]);

  return trackButton;
}
