import type {Location, Query} from 'history';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

import type {SpanSort, SpanSortOption} from './types';
import {SpanSortOthers, SpanSortPercentiles} from './types';

function generateSpansRoute({
  organization,
  view,
}: {
  organization: Organization;
  view?: DomainView;
}): string {
  return `${getTransactionSummaryBaseUrl(organization, view)}/spans/`;
}

export function spansRouteWithQuery({
  organization,
  transaction,
  projectID,
  query,
  view,
}: {
  organization: Organization;
  query: Query;
  transaction: string;
  projectID?: string | string[];
  view?: DomainView;
}) {
  const pathname = generateSpansRoute({
    organization,
    view,
  });

  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query,
    },
  };
}

const SPAN_SORT_OPTIONS: SpanSortOption[] = [
  {
    prefix: t('Sort By'),
    label: t('Total Self Time'),
    field: SpanSortOthers.SUM_EXCLUSIVE_TIME,
  },
  {
    prefix: t('Sort By'),
    label: t('Average Count'),
    field: SpanSortOthers.AVG_OCCURRENCE,
  },
  {
    prefix: t('Sort By'),
    label: t('p50 Self Time'),
    field: SpanSortPercentiles.P50_EXCLUSIVE_TIME,
  },
  {
    prefix: t('Sort By'),
    label: t('p75 Self Time'),
    field: SpanSortPercentiles.P75_EXCLUSIVE_TIME,
  },
  {
    prefix: t('Sort By'),
    label: t('p95 Self Time'),
    field: SpanSortPercentiles.P95_EXCLUSIVE_TIME,
  },
  {
    prefix: t('Sort By'),
    label: t('p99 Self Time'),
    field: SpanSortPercentiles.P99_EXCLUSIVE_TIME,
  },
];

const DEFAULT_SORT = SpanSortOthers.SUM_EXCLUSIVE_TIME;

function getSuspectSpanSort(sort: string): SpanSortOption {
  const selected = SPAN_SORT_OPTIONS.find(option => option.field === sort);
  if (selected) {
    return selected;
  }
  return SPAN_SORT_OPTIONS.find(option => option.field === DEFAULT_SORT)!;
}

export function getSuspectSpanSortFromLocation(
  location: Location,
  sortKey = 'sort'
): SpanSortOption {
  const sort = decodeScalar(location?.query?.[sortKey]) ?? DEFAULT_SORT;
  return getSuspectSpanSort(sort);
}

export const SPAN_SORT_TO_FIELDS: Record<SpanSort, string[]> = {
  [SpanSortOthers.SUM_EXCLUSIVE_TIME]: [
    'percentileArray(spans_exclusive_time, 0.75)',
    'count()',
    'count_unique(id)',
    'sumArray(spans_exclusive_time)',
  ],
  [SpanSortOthers.AVG_OCCURRENCE]: [
    'percentileArray(spans_exclusive_time, 0.75)',
    'count()',
    'count_unique(id)',
    'equation|count() / count_unique(id)',
    'sumArray(spans_exclusive_time)',
  ],
  [SpanSortPercentiles.P50_EXCLUSIVE_TIME]: [
    'percentileArray(spans_exclusive_time, 0.5)',
    'count()',
    'count_unique(id)',
    'sumArray(spans_exclusive_time)',
  ],
  [SpanSortPercentiles.P75_EXCLUSIVE_TIME]: [
    'percentileArray(spans_exclusive_time, 0.75)',
    'count()',
    'count_unique(id)',
    'sumArray(spans_exclusive_time)',
  ],
  [SpanSortPercentiles.P95_EXCLUSIVE_TIME]: [
    'percentileArray(spans_exclusive_time, 0.95)',
    'count()',
    'count_unique(id)',
    'sumArray(spans_exclusive_time)',
  ],
  [SpanSortPercentiles.P99_EXCLUSIVE_TIME]: [
    'percentileArray(spans_exclusive_time, 0.99)',
    'count()',
    'count_unique(id)',
    'sumArray(spans_exclusive_time)',
  ],
};
