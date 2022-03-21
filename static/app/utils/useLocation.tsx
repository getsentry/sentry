import {useContext} from 'react';

import {RouteContext} from 'sentry/views/routeContext';

function useLocation() {
  const route = useContext(RouteContext);
  return route?.location;
}

export default useLocation;
