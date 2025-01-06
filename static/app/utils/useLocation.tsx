import {useMemo} from 'react';
import {useLocation as useReactRouter6Location} from 'react-router-dom';
import type {Location, Query} from 'history';

import {useTestRouteContext} from 'sentry/utils/useRouteContext';

import {location6ToLocation3} from './reactRouter6Compat/location';

type DefaultQuery<T = string> = {
  [key: string]: T | T[] | null | undefined;
};

export function useLocation<Q extends Query = DefaultQuery>(): Location<Q> {
  // When running in test mode we still read from the legacy route context to
  // keep test compatability while we fully migrate to react router 6
  const testRouteContext = useTestRouteContext();

  if (testRouteContext) {
    return testRouteContext.location;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const router6Location = useReactRouter6Location();

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const location = useMemo(
    () => location6ToLocation3<Q>(router6Location),
    [router6Location]
  );

  return location;
}
