import {useCallback} from 'react';
import * as qs from 'query-string';

import {useLocation} from 'sentry/utils/useLocation';

export const NEW_FORMULA = 'new';

/**
 * The builder opens from the `formula` query param so a formula can be linked to,
 * either by id or as `new` to start an empty one.
 */
export function useFormulaBuilderUrl() {
  const location = useLocation();

  return useCallback(
    (formula: string) =>
      `${location.pathname}?${qs.stringify({...location.query, formula})}`,
    [location.pathname, location.query]
  );
}
