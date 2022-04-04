import {useContext} from 'react';

import {RouteContext} from 'sentry/views/routeContext';

export function useLocation() {
  const route = useContext(RouteContext);
  if (route === null) {
    throw new Error('useLocation called outside of routes provider');
  }
  return route?.location;
}
