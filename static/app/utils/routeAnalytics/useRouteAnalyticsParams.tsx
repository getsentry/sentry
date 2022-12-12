import {useContext, useEffect} from 'react';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

/**
 * Sets the analyitcs params for route analytics events.
 * Must be called within 2s after the organization context is loaded.
 */
export default function useRouteAnalyticsParams(params: Record<string, any>) {
  const {setRouteAnalyticsParams, previousUrl} = useContext(RouteAnalyticsContext);
  const jsonParams = JSON.stringify(params);
  useEffect(() => {
    setRouteAnalyticsParams(params);
    // use the object values and keys as dependencies to re-trigger rendering
    // if the underlying parameters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonParams, previousUrl]);
}
