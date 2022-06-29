import {Location, Query} from 'history';

import {useRouteContext} from 'sentry/utils/useRouteContext';

type DefaultQuery<T = string> = {
  [key: string]: T | T[] | null | undefined;
};

export function useLocation<Q extends Query = DefaultQuery>(): Location<Q> {
  const route = useRouteContext();
  return route.location;
}
