import type {SearchQueryBuilderProps} from 'sentry/components/searchQueryBuilder';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {queryIsValid} from 'sentry/components/searchQueryBuilder/utils';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';
import usePrevious from 'sentry/utils/usePrevious';

export function useOnChange({
  onChange,
  searchOnChange,
}: Pick<SearchQueryBuilderProps, 'onChange' | 'searchOnChange'>) {
  const {committedQuery, handleSearch, parseQuery} = useSearchQueryBuilder();

  const previousCommittedQuery = usePrevious(committedQuery);

  useEffectAfterFirstRender(() => {
    if (committedQuery !== previousCommittedQuery) {
      if (onChange) {
        const parsedQuery = parseQuery(committedQuery);
        onChange(committedQuery, {parsedQuery, queryIsValid: queryIsValid(parsedQuery)});
      }

      if (searchOnChange) {
        handleSearch(committedQuery);
      }
    }
  }, [
    committedQuery,
    previousCommittedQuery,
    onChange,
    handleSearch,
    searchOnChange,
    parseQuery,
  ]);
}
