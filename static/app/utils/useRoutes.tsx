import {useContext} from 'react';

import {RouteContext} from 'sentry/views/routeContext';

export function useRoutes() {
  const route = useContext(RouteContext);
  if (route === null) {
    throw new Error('useRoutes called outside of routes provider');
  }
  return route?.routes;
}
