import type {Query} from 'history';

import {URL_PARAM} from 'sentry/constants/pageFilters';
import {
  decodeBoolean,
  decodeInteger,
  decodeList,
  decodeScalar,
} from 'sentry/utils/queryString';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

export function createIssueViewFromUrl({
  query,
}: {
  query: Query;
}): Pick<
  GroupSearchView,
  'query' | 'querySort' | 'projects' | 'environments' | 'timeFilters'
> {
  return {
    query: typeof query.query === 'string' ? query.query : '',
    querySort:
      typeof query.sort === 'string'
        ? (query.sort as IssueSortOptions)
        : IssueSortOptions.DATE,
    projects: decodeList(query[URL_PARAM.PROJECT]).map(decodeInteger),
    environments: decodeList(query[URL_PARAM.ENVIRONMENT]),
    timeFilters: {
      start: decodeScalar(query[URL_PARAM.START]) ?? null,
      end: decodeScalar(query[URL_PARAM.END]) ?? null,
      period: decodeScalar(query[URL_PARAM.PERIOD]) ?? null,
      utc: decodeBoolean(query[URL_PARAM.UTC]) ?? null,
    },
  };
}
