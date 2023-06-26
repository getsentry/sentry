import {useContext, useEffect} from 'react';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

/**
 * Disables route analytics when called in a component.
 * Must be called within 4s after the organization context is loaded.
 */
export default function useDisableRouteAnalytics(disabled = true) {
  const {setDisableRouteAnalytics, previousUrl} = useContext(RouteAnalyticsContext);
  useEffect(() => {
    setDisableRouteAnalytics(disabled);
  }, [setDisableRouteAnalytics, previousUrl, disabled]);
}
