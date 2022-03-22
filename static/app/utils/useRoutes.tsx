import {useContext} from 'react';

import {RouteContext} from 'sentry/views/routeContext';

function useRoutes() {
  const route = useContext(RouteContext);
  return route?.routes;
}

export default useRoutes;
