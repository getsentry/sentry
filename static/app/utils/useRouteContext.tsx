import {useContext} from 'react';

import {RouteContext} from 'sentry/views/routeContext';

export function useRouteContext() {
  return useContext(RouteContext);
}
