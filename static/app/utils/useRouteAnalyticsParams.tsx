import {useContext, useEffect} from 'react';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

/**
 * Sets the analyitcs params for route analytics events
 */
export default function useRouteAnalyticsParams(params: Record<string, any>) {
  const {setRouteAnalyticsParams} = useContext(RouteAnalyticsContext);
  const dependencies = Object.values(params);
  useEffect(() => {
    setRouteAnalyticsParams(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
