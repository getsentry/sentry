import {useContext, useEffect} from 'react';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

/**
 * Sets the analyitcs params for route analytics events
 */
export default function useDisableRouteAnalytics() {
  const {setDisableRouteAnalytics} = useContext(RouteAnalyticsContext);
  useEffect(() => {
    setDisableRouteAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
