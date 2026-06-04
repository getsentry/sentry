import {useContext} from 'react';

import {registerSetOrganizationCallback} from 'sentry/utils/routeAnalytics/setOrganizationCallback';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

/**
 * Sets the organization for route analytics events.
 * Only needs to be used once for the entire app just
 * below the Organization context.
 */
export function useRouteAnalyticsHookSetup() {
  const {setOrganization} = useContext(RouteAnalyticsContext);
  registerSetOrganizationCallback(setOrganization);
}
