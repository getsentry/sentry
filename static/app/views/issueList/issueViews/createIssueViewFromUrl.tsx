import type {Query} from 'history';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {
  decodeBoolean,
  decodeInteger,
  decodeList,
  decodeScalar,
} from 'sentry/utils/queryString';
import type {IssueViewParams} from 'sentry/views/issueList/issueViews/utils';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

export function createIssueViewFromUrl({query}: {query: Query}): IssueViewParams {
  const normalizedTimeFilters = normalizeDateTimeParams(query);

  return {
    query: typeof query.query === 'string' ? query.query : '',
    querySort:
      typeof query.sort === 'string'
        ? (query.sort as IssueSortOptions)
        : IssueSortOptions.DATE,
    projects: decodeList(query[URL_PARAM.PROJECT]).map(decodeInteger),
    environments: decodeList(query[URL_PARAM.ENVIRONMENT]),
    timeFilters: {
      start: decodeScalar(normalizedTimeFilters.start) ?? null,
      end: decodeScalar(normalizedTimeFilters.end) ?? null,
      period: decodeScalar(normalizedTimeFilters.statsPeriod) ?? null,
      utc: decodeBoolean(normalizedTimeFilters.utc) ?? null,
    },
  };
}
