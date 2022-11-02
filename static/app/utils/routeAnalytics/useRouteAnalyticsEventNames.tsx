import {useContext, useEffect} from 'react';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

/**
 * This hook provides custom analytics event names for route based analytics.
 * @param eventKey The key used to identify the event
 * @param eventName The English string used as the event name
 */
export default function useRouteAnalyticsEventNames(eventKey: string, eventName: string) {
  const {setEventNames, previousUrl} = useContext(RouteAnalyticsContext);
  useEffect(() => {
    setEventNames(eventKey, eventName);
  }, [setEventNames, eventKey, eventName, previousUrl]);
}
