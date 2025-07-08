import {useMemo} from 'react';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useRecentSearches} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/useRecentSearches';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {
  type ParseResult,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import type {RecentSearch, TagCollection} from 'sentry/types/group';

const MAX_RECENT_FILTERS = 3;
const NO_FILTERS: any = [];

// If the recent searches are very long, this prevents the parser from taking too long
const MAX_QUERY_PARSE_LENGTH = 500;

function getFiltersFromParsedQuery(
  parsedQuery: ParseResult | null
): Array<TokenResult<Token.FILTER>> {
  if (!parsedQuery) {
    return [];
  }

  return parsedQuery.filter(token => token.type === Token.FILTER);
}

function getTokensFromQuery({
  query,
  getFieldDefinition,
  filterKeys,
  filterKeyAliases,
}: {
  filterKeys: TagCollection;
  getFieldDefinition: FieldDefinitionGetter;
  query: string;
  filterKeyAliases?: TagCollection;
}): Array<TokenResult<Token.FILTER>> {
  const parsed = parseQueryBuilderValue(
    query.slice(0, MAX_QUERY_PARSE_LENGTH),
    getFieldDefinition,
    {filterKeys, filterKeyAliases}
  );

  return getFiltersFromParsedQuery(parsed);
}

type FilterCounter = Record<
  string,
  {
    count: number;
    token: TokenResult<Token.FILTER>;
  }
>;

function getFiltersFromRecentSearches(
  recentSearchesData: RecentSearch[] | undefined,
  {
    parsedCurrentQuery,
    filterKeys,
    filterKeyAliases,
    getFieldDefinition,
  }: {
    filterKeys: TagCollection;
    getFieldDefinition: FieldDefinitionGetter;
    parsedCurrentQuery: ParseResult | null;
    filterKeyAliases?: TagCollection;
  }
): Array<TokenResult<Token.FILTER>> {
  if (!recentSearchesData?.length) {
    return NO_FILTERS;
  }
  const filtersInCurrentQuery = new Set(
    getFiltersFromParsedQuery(parsedCurrentQuery).map(token => getKeyName(token.key))
  );

  const filterCounts: FilterCounter = recentSearchesData
    .flatMap(search =>
      getTokensFromQuery({
        query: search.query,
        getFieldDefinition,
        filterKeys,
        filterKeyAliases,
      })
    )
    .filter(token => {
      const filter = getKeyName(token.key);
      // We want to show recent filters that are not already in the current query
      // and are valid filter keys
      return !filtersInCurrentQuery.has(filter) && !!filterKeys[filter];
    })
    .reduce((acc, token) => {
      const filter = getKeyName(token.key);
      if (acc[filter]) {
        acc[filter].count += 1;
      } else {
        acc[filter] = {
          token,
          count: 1,
        };
      }
      return acc;
    }, {} as FilterCounter);

  return Object.entries(filterCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([_, filter]) => filter.token)
    .slice(0, MAX_RECENT_FILTERS);
}

/**
 * Fetches and returns a list of filter keys that are present in recent
 * searches but not in the current query.
 * Orders by highest count of filter key occurrences.
 */
export function useRecentSearchFilters() {
  const {parsedQuery, filterKeys, getFieldDefinition, filterKeyAliases} =
    useSearchQueryBuilder();
  const {data: recentSearchesData} = useRecentSearches();

  const filters = useMemo(
    () =>
      getFiltersFromRecentSearches(recentSearchesData, {
        parsedCurrentQuery: parsedQuery,
        filterKeys,
        getFieldDefinition,
        filterKeyAliases,
      }),
    [filterKeys, getFieldDefinition, parsedQuery, recentSearchesData, filterKeyAliases]
  );

  return filters;
}
