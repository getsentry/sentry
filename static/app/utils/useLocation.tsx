import {useMemo} from 'react';
import {useLocation as useReactRouter6Location} from 'react-router-dom';
import type {Location, Query} from 'history';

import {location6ToLocation3} from './reactRouter6Compat/location';

export type QueryParamValue<T = string> = T | T[] | null | undefined;
type DefaultQuery<T = string> = Record<string, QueryParamValue<T>>;

export function useLocation<Q extends Query = DefaultQuery>(): Location<Q> {
  const router6Location = useReactRouter6Location();

  const location = useMemo(
    () => location6ToLocation3<Q>(router6Location),
    [router6Location]
  );

  return location;
}
