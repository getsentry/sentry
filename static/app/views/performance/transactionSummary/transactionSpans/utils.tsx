import {Location, Query} from 'history';

import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';

import {SpanSortOption, SpanSortOthers, SpanSortPercentiles} from './types';

export function generateSpansRoute({orgSlug}: {orgSlug: String}): string {
  return `/organizations/${orgSlug}/performance/summary/spans/`;
}

export function spansRouteWithQuery({
  orgSlug,
  transaction,
  projectID,
  query,
}: {
  orgSlug: string;
  transaction: string;
  query: Query;
  projectID?: string | string[];
}) {
  const pathname = generateSpansRoute({
    orgSlug,
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

export const SPAN_SORT_OPTIONS: SpanSortOption[] = [
  {
    prefix: t('Sort By'),
    label: t('Total Exclusive Time'),
    field: SpanSortOthers.SUM_EXCLUSIVE_TIME,
  },
  {
    prefix: t('Sort By'),
    label: t('Average Count'),
    field: SpanSortOthers.AVG_OCCURRENCE,
  },
  {
    prefix: t('Sort By'),
    label: t('Total Count'),
    field: SpanSortOthers.COUNT,
  },
  {
    prefix: t('Sort By'),
    label: t('p50 Exclusive Time'),
    field: SpanSortPercentiles.P50_EXCLUSIVE_TIME,
  },
  {
    prefix: t('Sort By'),
    label: t('p75 Exclusive Time'),
    field: SpanSortPercentiles.P75_EXCLUSIVE_TIME,
  },
  {
    prefix: t('Sort By'),
    label: t('p95 Exclusive Time'),
    field: SpanSortPercentiles.P95_EXCLUSIVE_TIME,
  },
  {
    prefix: t('Sort By'),
    label: t('p99 Exclusive Time'),
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
  sortKey: string = 'sort'
): SpanSortOption {
  const sort = decodeScalar(location?.query?.[sortKey]) ?? DEFAULT_SORT;
  return getSuspectSpanSort(sort);
}

export function getSuspectSpanSortFromEventView(eventView: EventView): SpanSortOption {
  const sort = eventView.sorts.length ? eventView.sorts[0].field : DEFAULT_SORT;
  return getSuspectSpanSort(sort);
}
