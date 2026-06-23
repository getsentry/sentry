import {useMemo} from 'react';
import {useMatches} from 'react-router-dom';

import type {PlainRoute} from 'sentry/types/legacyReactRouter';
import {matchesToRoutes} from 'sentry/utils/recreateRoute';

/**
 * @deprecated Please do not use this. Switch to useMatches() from 'react-router-dom'
 *
 * See https://github.com/getsentry/frontend-tsc/issues/78
 */
export function useRoutes(): PlainRoute[] {
  const matches = useMatches();
  return useMemo(() => matchesToRoutes(matches), [matches]);
}
