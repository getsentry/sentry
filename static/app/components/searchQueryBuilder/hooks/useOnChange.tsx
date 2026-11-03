import {useEffectEvent, useLayoutEffect, useRef} from 'react';

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
  const syncedInitialQueryRef = useRef<string | null>(null);

  useEffectAfterFirstRender(() => {
    if (committedQuery !== previousCommittedQuery) {
      // A query that replaceRawSearchKeys rewrote differs from initialQuery, so it still emits.
      const isSyncedInitialQuery = committedQuery === syncedInitialQueryRef.current;
      syncedInitialQueryRef.current = null;
      if (isSyncedInitialQuery) {
        return;
      }

      if (onChange) {
        const parsedQuery = parseQuery(committedQuery);
        onChange(committedQuery, {parsedQuery, queryIsValid: queryIsValid(parsedQuery)});
      }

      handleSearch(committedQuery);
    }
  }, [committedQuery, previousCommittedQuery, onChange, handleSearch, parseQuery]);

  const isHeldByBuilder = useEffectEvent(
    (value: string) => value === committedQuery || value === query
  );

  const previousInitialQueryRef = useRef(initialQuery);
  useLayoutEffect(() => {
    // Mounting inside a provider that holds another query (e.g. after Ask Seer) still emits.
    if (initialQuery !== previousInitialQueryRef.current) {
      previousInitialQueryRef.current = initialQuery;
      // A parent echoing a query the builder already holds (e.g. from clear or Enter) still gets onChange.
      syncedInitialQueryRef.current = isHeldByBuilder(initialQuery) ? null : initialQuery;
    }
    dispatch({type: 'UPDATE_QUERY', query: initialQuery, ignoreDisabled: true});
  }, [dispatch, initialQuery]);
}
