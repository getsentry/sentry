import {useLayoutEffect, useRef} from 'react';

import type {SearchQueryBuilderProps} from 'sentry/components/searchQueryBuilder';
import {useSearchQueryBuilderState} from 'sentry/components/searchQueryBuilder/context';
import {queryIsValid} from 'sentry/components/searchQueryBuilder/utils';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';
import {usePrevious} from 'sentry/utils/usePrevious';

export function useOnChange({
  initialQuery,
  onChange,
}: Pick<SearchQueryBuilderProps, 'initialQuery' | 'onChange'>) {
  const {
    committedQuery,
    committedQueryFromInitialQuery,
    dispatch,
    handleSearch,
    parseQuery,
  } = useSearchQueryBuilderState();

  const previousCommittedQuery = usePrevious(committedQuery);

  useEffectAfterFirstRender(() => {
    if (committedQuery !== previousCommittedQuery && !committedQueryFromInitialQuery) {
      if (onChange) {
        const parsedQuery = parseQuery(committedQuery);
        onChange(committedQuery, {parsedQuery, queryIsValid: queryIsValid(parsedQuery)});
      }

      handleSearch(committedQuery);
    }
  }, [
    committedQuery,
    committedQueryFromInitialQuery,
    previousCommittedQuery,
    onChange,
    handleSearch,
    parseQuery,
  ]);

  const previousInitialQueryRef = useRef(initialQuery);
  useLayoutEffect(() => {
    // Mounting inside a provider that holds another query (e.g. after Ask Seer) still emits.
    const fromInitialQuery = initialQuery !== previousInitialQueryRef.current;
    previousInitialQueryRef.current = initialQuery;
    dispatch({
      type: 'UPDATE_QUERY',
      query: initialQuery,
      ignoreDisabled: true,
      fromInitialQuery,
    });
  }, [dispatch, initialQuery]);
}
