import {useFetchRecentSearches} from 'sentry/actionCreators/savedSearches';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {type ParseResult, Token} from 'sentry/components/searchSyntax/parser';
import type {RecentSearch, TagCollection} from 'sentry/types/group';

const MAX_RECENT_FILTERS = 5;

function getFiltersFromParsedQuery(parsedQuery: ParseResult | null) {
  if (!parsedQuery) {
    return [];
  }

  return parsedQuery
    .filter(token => token.type === Token.FILTER)
    .map(token => token.key.text);
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
  const parsed = parseQueryBuilderValue(query, getFieldDefinition, {
    filterKeys,
  });

  return getFiltersFromParsedQuery(parsed);
}

function getFiltersFromRecentSearches(
  recentSearchesData: RecentSearch[],
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
  if (!recentSearchesData.length) {
    return [];
  }

  const filtersInCurrentQuery = getFiltersFromParsedQuery(parsedCurrentQuery);

  const filterCounts: {[filter: string]: number} = recentSearchesData
    .flatMap(search =>
      getFiltersFromQuery({query: search.query, getFieldDefinition, filterKeys})
    )
    .filter(filter => !filtersInCurrentQuery.includes(filter))
    .reduce((acc, filter) => {
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
  const {recentSearches, parsedQuery, filterKeys, getFieldDefinition} =
    useSearchQueryBuilder();

  const {data: recentSearchesData} = useFetchRecentSearches(
    {
      savedSearchType: recentSearches ?? null,
      limit: 10,
    },
    {
      staleTime: 30_000,
    }
  );

  const filters = getFiltersFromRecentSearches(recentSearchesData ?? [], {
    parsedCurrentQuery: parsedQuery,
    filterKeys,
    getFieldDefinition,
  });

  return filters;
}
