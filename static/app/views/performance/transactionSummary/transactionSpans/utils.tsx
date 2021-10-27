import {Location, Query} from 'history';

import {t} from 'app/locale';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';

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
    prefix: t('Percentile'),
    label: t('p50'),
    field: SpanSortPercentiles.P50_EXCLUSIVE_TIME,
  },
  {
    prefix: t('Percentile'),
    label: t('p75'),
    field: SpanSortPercentiles.P75_EXCLUSIVE_TIME,
  },
  {
    prefix: t('Percentile'),
    label: t('p95'),
    field: SpanSortPercentiles.P95_EXCLUSIVE_TIME,
  },
  {
    prefix: t('Percentile'),
    label: t('p99'),
    field: SpanSortPercentiles.P99_EXCLUSIVE_TIME,
  },
  {
    prefix: t('Total'),
    label: t('Cumulative Duration'),
    field: SpanSortOthers.SUM_EXCLUSIVE_TIME,
  },
  {
    prefix: t('Total'),
    label: t('Occurrences'),
    field: SpanSortOthers.COUNT,
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

export function getSuspectSpanSortFromLocation(location: Location): SpanSortOption {
  const sort = decodeScalar(location?.query?.sort) ?? DEFAULT_SORT;
  return getSuspectSpanSort(sort);
}

export function getSuspectSpanSortFromEventView(eventView: EventView): SpanSortOption {
  const sort = eventView.sorts.length ? eventView.sorts[0].field : DEFAULT_SORT;
  return getSuspectSpanSort(sort);
}
