import {useContext} from 'react';

import {RouteContext} from 'sentry/views/routeContext';

function useParams() {
  const route = useContext(RouteContext);
  return route?.params;
}

export default useParams;
