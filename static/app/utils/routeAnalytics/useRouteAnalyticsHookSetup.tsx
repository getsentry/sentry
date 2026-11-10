import {useContext} from 'react';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

import {registerSetOrganizationCallback} from './setOrganizationCallback';

/**
 * Sets the organization for route analytics events.
 * Only needs to be used once for the entire app just
 * below the Organization context.
 */
export function useRouteAnalyticsHookSetup() {
  const {setOrganization} = useContext(RouteAnalyticsContext);
  registerSetOrganizationCallback(setOrganization);
}
