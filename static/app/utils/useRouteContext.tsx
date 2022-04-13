import {useContext} from 'react';

import {RouteContext} from 'sentry/views/routeContext';

export function useRouteContext() {
  const route = useContext(RouteContext);
  if (route === null) {
    throw new Error(`useRouteContext called outside of routes provider`);
  }
  return route;
}
