import {useEffect, useRef} from 'react';

import type {TraceQueryWriter} from './useTraceQueryWriter';

// Syncs query params with URL state. Only performs a state sync if the query params have changed.
// Waterfalls embedded in another page (e.g. a Seer response) opt out with `disabled` so they do
// not rewrite the host page's query string.
export function useTraceQueryParamStateSync(
  query: Record<string, string | undefined>,
  options: {queryWriter: TraceQueryWriter; disabled?: boolean}
) {
  const previousQueryRef = useRef(query);
  const syncStateTimeoutRef = useRef<number | null>(null);
  const {queryWriter} = options;
  const disabled = options.disabled ?? false;

  useEffect(() => {
    if (disabled) {
      return;
    }

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
      queryWriter.writeQuery(previousQueryRef.current);
    }, 1000);
  }, [disabled, queryWriter, query]);
}
