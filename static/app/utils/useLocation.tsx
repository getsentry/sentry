import {useMemo} from 'react';
import {useLocation as useReactRouterLocation} from 'react-router';
import type {Location, Query} from 'history';

import {toLegacyLocation} from 'sentry/router/legacy/location';

export type QueryParamValue<T = string> = T | T[] | null | undefined;
type DefaultQuery<T = string> = Record<string, QueryParamValue<T>>;

export function useLocation<Q extends Query = DefaultQuery>(): Location<Q> {
  const routerLocation = useReactRouterLocation();

  const location = useMemo(() => toLegacyLocation<Q>(routerLocation), [routerLocation]);

  return location;
}
