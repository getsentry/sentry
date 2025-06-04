import {useContext} from 'react';

import HookStore from 'sentry/stores/hookStore';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

/**
 * Sets the organization for route analytics events.
 * Only needs to be used once for the entire app just
 * below the Organization context.
 */
export default function useRouteAnalyticsHookSetup() {
  const {setOrganization} = useContext(RouteAnalyticsContext);
  HookStore.persistCallback(
    'react-hook:route-activated',
    'setOrganization',
    setOrganization
  );
}
