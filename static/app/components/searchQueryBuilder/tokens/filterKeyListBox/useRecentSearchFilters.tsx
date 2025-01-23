import {useMemo} from 'react';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useRecentSearches} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/useRecentSearches';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {type ParseResult, Token} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import type {RecentSearch, TagCollection} from 'sentry/types/group';

const MAX_RECENT_FILTERS = 3;
const NO_FILTERS: any = [];

// If the recent searches are very long, this prevents the parser from taking too long
const MAX_QUERY_PARSE_LENGTH = 500;

function getFiltersFromParsedQuery(parsedQuery: ParseResult | null) {
  if (!parsedQuery) {
    return [];
  }

  return parsedQuery
    .filter(token => token.type === Token.FILTER)
    .map(token => getKeyName(token.key));
}

function getFiltersFromQuery({
  query,
  getFieldDefinition,
  filterKeys,
}: {
  filterKeys: TagCollection;
  getFieldDefinition: FieldDefinitionGetter;
  query: string;
}) {
  const parsed = parseQueryBuilderValue(
    query.slice(0, MAX_QUERY_PARSE_LENGTH),
    getFieldDefinition,
    {
      filterKeys,
    }
  );

  return getFiltersFromParsedQuery(parsed);
}

function getFiltersFromRecentSearches(
  recentSearchesData: RecentSearch[] | undefined,
  {
    parsedCurrentQuery,
    filterKeys,
    getFieldDefinition,
  }: {
    filterKeys: TagCollection;
    getFieldDefinition: FieldDefinitionGetter;
    parsedCurrentQuery: ParseResult | null;
  }
) {
  if (!recentSearchesData?.length) {
    return NO_FILTERS;
  }
  const filtersInCurrentQuery = getFiltersFromParsedQuery(parsedCurrentQuery);

  const filterCounts: {[filter: string]: number} = recentSearchesData
    .flatMap(search =>
      getFiltersFromQuery({query: search.query, getFieldDefinition, filterKeys})
    )
    .filter(
      filter =>
        // We want to show recent filters that are not already in the current query
        // and are valid filter keys
        !filtersInCurrentQuery.includes(filter) && !!filterKeys[filter]
    )
    .reduce((acc, filter) => {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      acc[filter] = (acc[filter] ?? 0) + 1;
      return acc;
    }, {});

  return Object.entries(filterCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([filter]) => filter)
    .slice(0, MAX_RECENT_FILTERS);
}

/**
 * Fetches and returns a list of filter keys that are present in recent
 * searches but not in the current query.
 * Orders by highest count of filter key occurrences.
 */
export function useRecentSearchFilters() {
  const {parsedQuery, filterKeys, getFieldDefinition} = useSearchQueryBuilder();
  const {data: recentSearchesData} = useRecentSearches();

  const filters = useMemo(
    () =>
      getFiltersFromRecentSearches(recentSearchesData, {
        parsedCurrentQuery: parsedQuery,
        filterKeys,
        getFieldDefinition,
      }),
    [filterKeys, getFieldDefinition, parsedQuery, recentSearchesData]
  );

  return filters;
}
