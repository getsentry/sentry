import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {Query} from 'history';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

type QueryUpdates = Record<string, string | string[] | null | undefined>;

export interface TraceQueryWriter {
  /**
   * The query the waterfall has written so far, including writes the router has not
   * rendered yet.
   */
  getQuery: () => Query;
  /**
   * Merges `updates` into the waterfall's query and replaces the current history entry.
   * Keys set to `undefined` or `null` are removed.
   */
  writeQuery: (updates: QueryUpdates) => void;
}

function changedKeys(next: Query, previous: Query): Query {
  const changes: Query = {};

  for (const key of Object.keys(next)) {
    if (next[key] !== previous[key]) {
      changes[key] = next[key];
    }
  }

  return changes;
}

/**
 * Writes the waterfall's query params without clobbering its own in-flight writes.
 *
 * The waterfall updates the URL from several debounced callbacks - the selected node,
 * the field of view and the search query - and each of them needs to preserve the params
 * the others own. Merging onto the location is not enough: the router's location lags
 * behind the writes that are already in flight, so whichever callback fired last would
 * silently drop params the earlier ones had just written. Instead we keep the query the
 * waterfall has written so far and merge onto that, adopting params that changed outside
 * of the waterfall as the router catches up.
 */
export function useTraceQueryWriter(): TraceQueryWriter {
  const location = useLocation();
  const navigate = useNavigate();

  const writtenQueryRef = useRef<Query>(location.query);
  const observedQueryRef = useRef<Query>(location.query);
  const pathnameRef = useRef(location.pathname);

  useEffect(() => {
    // Params the waterfall did not write - page filters, the environment, another view
    // pushing state - still need to win, so adopt everything that changed on the router
    // since we last looked. Params we have written but the router has not rendered yet
    // are left alone.
    const observed = observedQueryRef.current;
    const adopted = {
      ...writtenQueryRef.current,
      ...changedKeys(location.query, observed),
    };

    for (const key of Object.keys(observed)) {
      if (!(key in location.query)) {
        delete adopted[key];
      }
    }

    observedQueryRef.current = location.query;
    writtenQueryRef.current = adopted;
    pathnameRef.current = location.pathname;
  }, [location.query, location.pathname]);

  const getQuery = useCallback(() => writtenQueryRef.current, []);

  const writeQuery = useCallback(
    (updates: QueryUpdates) => {
      const query: Query = {...writtenQueryRef.current};

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null) {
          delete query[key];
        } else {
          query[key] = value;
        }
      }

      writtenQueryRef.current = query;
      navigate({pathname: pathnameRef.current, query}, {replace: true});
    },
    [navigate]
  );

  return useMemo(() => ({getQuery, writeQuery}), [getQuery, writeQuery]);
}
