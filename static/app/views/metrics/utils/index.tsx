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
    if (!value) {
      return;
    }
    updateType === MetricSeriesFilterUpdateType.ADD
      ? addToFilter(mutableSearch, key, value)
      : excludeFromFilter(mutableSearch, key, value);
  });

  const extendedQuery = mutableSearch.formatString();
  const newGroupBy = (query.groupBy ?? []).filter(tag => !groupBys[tag]);

  return {
    ...query,
    query: extendedQuery,
    groupBy: newGroupBy,
  };
}
