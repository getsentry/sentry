import {Location, Query} from 'history';

import {useRouteContext} from 'sentry/utils/useRouteContext';

export function useLocation<Q extends Query>(): Location<Q> {
  const route = useRouteContext();
  return route.location;
}
