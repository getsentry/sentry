import {useEffect, useRef} from 'react';
import {browserHistory} from 'react-router';
import * as qs from 'query-string';

export function useTraceQueryParamStateSync(query: Record<string, string | undefined>) {
  const previousQueryRef = useRef<Record<string, string | undefined>>(query);
  const syncStateTimeoutRef = useRef<number | null>(null);

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
      browserHistory.replace({
        pathname: location.pathname,
        query: {
          ...qs.parse(location.search),
          ...previousQueryRef.current,
        },
      });
    }, 1000);
  }, [query]);
}
