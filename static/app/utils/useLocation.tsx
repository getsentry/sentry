import {useMemo} from 'react';
import {useLocation as useReactRouter6Location} from 'react-router-dom';
import type {Location, Query} from 'history';

import {NODE_ENV} from 'sentry/constants';
import {useRouteContext} from 'sentry/utils/useRouteContext';

import {location6ToLocation3} from './reactRouter6Compat/location';

type DefaultQuery<T = string> = {
  [key: string]: T | T[] | null | undefined;
};

export function useLocation<Q extends Query = DefaultQuery>(): Location<Q> {
  // When running in test mode we still read from the legacy route context to
  // keep test compatability while we fully migrate to react router 6
  const useReactRouter6 = window.__SENTRY_USING_REACT_ROUTER_SIX && NODE_ENV !== 'test';

  if (!useReactRouter6) {
    // biome-ignore lint/correctness/useHookAtTopLevel: react-router 6 migration
    return useRouteContext().location;
  }

  // biome-ignore lint/correctness/useHookAtTopLevel: react-router 6 migration
  const router6Location = useReactRouter6Location();

  // biome-ignore lint/correctness/useHookAtTopLevel: react-router 6 migration
  const location = useMemo(
    () => location6ToLocation3<Q>(router6Location),
    [router6Location]
  );

  return location;
}
