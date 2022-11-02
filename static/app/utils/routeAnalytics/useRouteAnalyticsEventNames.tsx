import {useContext, useEffect} from 'react';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

export default function useRouteAnalyticsEventNames(eventKey: string, eventName: string) {
  const {setEventNames, previousUrl} = useContext(RouteAnalyticsContext);
  useEffect(() => {
    setEventNames(eventKey, eventName);
  }, [setEventNames, eventKey, eventName, previousUrl]);
}
