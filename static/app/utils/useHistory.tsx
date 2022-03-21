import {useContext} from 'react';

import {RouteContext} from 'sentry/views/routeContext';

function useHistory() {
  const route = useContext(RouteContext);
  return route?.router;
}

export default useHistory;
