import {useMemo} from 'react';

import {GridColumnSortBy} from 'sentry/components/gridEditable';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

interface UseProfileEventsSortOptions<F> {
  allowedKeys: readonly F[];
  fallback: {
    key: F;
    order: 'asc' | 'desc';
  };
  key: string;
}

export function useProfileEventsSort<F extends string>(
  options: UseProfileEventsSortOptions<F>
): GridColumnSortBy<F> {
  const location = useLocation();

  return useMemo(() => {
    let key = decodeScalar(
      location.query[options.key],
      options.fallback.order === 'asc' ? options.fallback.key : `-${options.fallback.key}`
    );

    const order: 'asc' | 'desc' = key[0] === '-' ? 'desc' : 'asc';
    key = order === 'asc' ? key : key.substring(1);

    if (!options.allowedKeys.includes(key as F)) {
      return options.fallback;
    }

    return {key: key as F, order};
  }, [location.query, options.allowedKeys, options.fallback, options.key]);
}
