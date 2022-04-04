import {useContext} from 'react';

import {RouteContext} from 'sentry/views/routeContext';

export function useParams() {
  const route = useContext(RouteContext);
  if (route === null) {
    throw new Error('useParams called outside of routes provider');
  }
  return route?.params;
}
