import {useEffect, useRef} from 'react';
import * as qs from 'query-string';

import {useNavigate} from 'sentry/utils/useNavigate';

// Syncs query params with URL state. Only performs a state sync if the query params have changed.
export function useTraceQueryParamStateSync(query: Record<string, string | undefined>) {
  const previousQueryRef = useRef<Record<string, string | undefined>>(query);
  const syncStateTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const keys = Object.keys(query);
    const previousKeys = Object.keys(previousQueryRef.current);

    if (
      keys.length === previousKeys.length &&
      keys.every(key => {
        return query[key] === previousQueryRef.current[key];
      })
    ) {
      previousQueryRef.current = query;
      return;
    }

    if (syncStateTimeoutRef.current !== null) {
      window.clearTimeout(syncStateTimeoutRef.current);
    }

    previousQueryRef.current = query;
    syncStateTimeoutRef.current = window.setTimeout(() => {
      navigate(
        {
          pathname: location.pathname,
          query: {
            ...qs.parse(location.search),
            ...previousQueryRef.current,
          },
        },
        {replace: true}
      );
    }, 1000);
  }, [navigate, query]);
}
