import {useEffect, useEffectEvent, useLayoutEffect, useRef} from 'react';

import type {SearchQueryBuilderProps} from 'sentry/components/searchQueryBuilder';
import {useSearchQueryBuilderState} from 'sentry/components/searchQueryBuilder/context';
import {queryIsValid} from 'sentry/components/searchQueryBuilder/utils';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';
import {usePrevious} from 'sentry/utils/usePrevious';

export function useOnChange({
  initialQuery,
  onChange,
}: Pick<SearchQueryBuilderProps, 'initialQuery' | 'onChange'>) {
  const {committedQuery, dispatch, handleSearch, parseQuery, query} =
    useSearchQueryBuilderState();

  const previousCommittedQuery = usePrevious(committedQuery);
  const syncedInitialQueriesRef = useRef(new Set<string>());

  useEffectAfterFirstRender(() => {
    if (committedQuery !== previousCommittedQuery) {
      // A query that replaceRawSearchKeys rewrote differs from initialQuery, so it still emits.
      if (syncedInitialQueriesRef.current.has(committedQuery)) {
        return;
      }

      if (onChange) {
        const parsedQuery = parseQuery(committedQuery);
        onChange(committedQuery, {parsedQuery, queryIsValid: queryIsValid(parsedQuery)});
      }

      handleSearch(committedQuery);
    }
  }, [committedQuery, previousCommittedQuery, onChange, handleSearch, parseQuery]);

  const previousInitialQuery = usePrevious(initialQuery);
  useEffect(() => {
    // Waits for initialQuery to settle so the emit effect above sees each synced commit.
    if (initialQuery === previousInitialQuery) {
      syncedInitialQueriesRef.current.clear();
    }
  });

  const isHeldByBuilder = useEffectEvent(
    (value: string) => value === committedQuery || value === query
  );

  const previousInitialQueryRef = useRef(initialQuery);
  useLayoutEffect(() => {
    // Mounting inside a provider that holds another query (e.g. after Ask Seer) still emits.
    if (initialQuery !== previousInitialQueryRef.current) {
      previousInitialQueryRef.current = initialQuery;
      // A parent echoing a query the builder already holds (e.g. from clear or Enter) still gets onChange.
      if (!isHeldByBuilder(initialQuery)) {
        syncedInitialQueriesRef.current.add(initialQuery);
      }
    }
    dispatch({type: 'UPDATE_QUERY', query: initialQuery, ignoreDisabled: true});
  }, [dispatch, initialQuery]);
}
