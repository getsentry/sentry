import type {SearchQueryBuilderProps} from 'sentry/components/searchQueryBuilder';
import {useSearchQueryBuilderState} from 'sentry/components/searchQueryBuilder/context';
import {queryIsValid} from 'sentry/components/searchQueryBuilder/utils';
import {InvalidReason, Token} from 'sentry/components/searchSyntax/parser';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';
import {usePrevious} from 'sentry/utils/usePrevious';

export function useOnChange({onChange}: Pick<SearchQueryBuilderProps, 'onChange'>) {
  const {committedQuery, handleSearch, parseQuery} = useSearchQueryBuilderState();

  const previousCommittedQuery = usePrevious(committedQuery);

  useEffectAfterFirstRender(() => {
    if (committedQuery !== previousCommittedQuery) {
      const parsedQuery = parseQuery(committedQuery);

      onChange?.(committedQuery, {parsedQuery, queryIsValid: queryIsValid(parsedQuery)});

      // Skip the auto-search while an AND / OR is missing a condition (e.g. the
      // user is part way through typing `foo OR bar`); the backend would reject
      // it. The token is marked invalid, so the user can see why.
      const hasDanglingLogicalOperator = parsedQuery?.some(
        token =>
          token.type === Token.LOGIC_BOOLEAN &&
          token.invalid?.type === InvalidReason.LOGICAL_OPERATOR_MISSING_CONDITION
      );
      if (!hasDanglingLogicalOperator) {
        handleSearch(committedQuery);
      }
    }
  }, [committedQuery, previousCommittedQuery, onChange, handleSearch, parseQuery]);
}
