import {
  FilterType,
  joinQuery,
  parseSearch,
  type SearchConfig,
  Token,
} from 'sentry/components/searchSyntax/parser';
import {defined} from 'sentry/utils';
import {
  MetricSeriesFilterUpdateType,
  type MetricsQuery,
} from 'sentry/utils/metrics/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {addToFilter, excludeFromFilter} from '../../discover/table/cellAction';

/**
 * Updates query string with tag values from the passed groupBys.
 */
export function extendQueryWithGroupBys(
  query: string,
  groupBys: (Record<string, string> | undefined)[]
) {
  const mutableSearch = new MutableSearch(query);

  groupBys.forEach(groupBy => {
    if (!groupBy) {
      return;
    }
    Object.entries(groupBy).forEach(([key, value]) => {
      if (!value) {
        return;
      }
      addToFilter(mutableSearch, key, value);
    });
  });

  return mutableSearch.formatString();
}

/**
 * Wraps text filters of a search string in quotes if they are not already.
 */
export function ensureQuotedTextFilters(
  query: string,
  configOverrides?: Partial<SearchConfig>
) {
  const parsedSearch = parseSearch(query, configOverrides);

  if (!parsedSearch) {
    return query;
  }

  for (let i = 0; i < parsedSearch.length; i++) {
    const token = parsedSearch[i]!;
    if (token.type === Token.FILTER && token.filter === FilterType.TEXT) {
      // joinQuery() does not access nested tokens, so we need to manipulate the text of the filter instead of its value
      if (!token.value.quoted) {
        token.text = `${token.negated ? '!' : ''}${token.key.text}:"${token.value.text}"`;
      }

      const spaceToken = parsedSearch[i + 1];
      const afterSpaceToken = parsedSearch[i + 2];
      if (
        spaceToken &&
        afterSpaceToken &&
        spaceToken.type === Token.SPACES &&
        spaceToken.text === '' &&
        afterSpaceToken.type === Token.FILTER
      ) {
        // Ensure there is a space between two filters
        spaceToken.text = ' ';
      }
    }
  }

  return joinQuery(parsedSearch);
}

/**
 * Used when a user clicks on filter button in the series summary table. Applies
 * tag values to the filter string of the query. Removes the tags from query groupyBy
 */
export function updateQueryWithSeriesFilter(
  query: MetricsQuery,
  groupBys: Record<string, string>,
  updateType: MetricSeriesFilterUpdateType
) {
  // TODO(metrics): This is a temporary solution to handle the case where the query has OR operator.
  // since addToFilter and excludeFromFilter do not handle it properly. We should refactor this to use
  // search syntax parser instead.
  const queryStr = query.query?.includes('OR') ? `(${query.query})` : query.query ?? '';
  const mutableSearch = new MutableSearch(queryStr);

  const groupByEntries = Object.entries(groupBys);
  groupByEntries.forEach(([key, value]) => {
    if (!defined(value)) {
      return;
    }
    if (updateType === MetricSeriesFilterUpdateType.ADD) {
      addToFilter(mutableSearch, key, value);
    } else {
      excludeFromFilter(mutableSearch, key, value);
    }
  });

  const extendedQuery = mutableSearch.formatString();
  const newGroupBy = (query.groupBy ?? []).filter(tag => !groupBys[tag]);

  return {
    ...query,
    query: ensureQuotedTextFilters(extendedQuery),
    groupBy: newGroupBy,
  };
}
