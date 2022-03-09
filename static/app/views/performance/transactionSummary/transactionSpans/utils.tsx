import {Location, Query} from 'history';
import pick from 'lodash/pick';

import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {SpanSort, SpanSortOption, SpanSortOthers, SpanSortPercentiles} from './types';

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
  query: Query;
  transaction: string;
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

export const SPAN_RETENTION_DAYS = 30;

export const SPAN_RELATIVE_PERIODS = pick(DEFAULT_RELATIVE_PERIODS, [
  '1h',
  '24h',
  '7d',
  '14d',
  '30d',
]);

export const SPAN_SORT_OPTIONS: SpanSortOption[] = [
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
    label: t('Total Count'),
    field: SpanSortOthers.COUNT,
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
  sortKey: string = 'sort'
): SpanSortOption {
  const sort = decodeScalar(location?.query?.[sortKey]) ?? DEFAULT_SORT;
  return getSuspectSpanSort(sort);
}

export function getSuspectSpanSortFromEventView(eventView: EventView): SpanSortOption {
  const sort = eventView.sorts.length ? eventView.sorts[0].field : DEFAULT_SORT;
  return getSuspectSpanSort(sort);
}

export function parseSpanSlug(spanSlug: string | undefined): SpanSlug | undefined {
  if (!defined(spanSlug)) {
    return undefined;
  }

  const delimiterPos = spanSlug.lastIndexOf(':');
  if (delimiterPos < 0) {
    return undefined;
  }

  const op = spanSlug.slice(0, delimiterPos);
  const group = spanSlug.slice(delimiterPos + 1);

  return {op, group};
}

export function generateSpansEventView({
  location,
  transactionName,
  isMetricsData,
}: {
  isMetricsData: boolean;
  location: Location;
  transactionName: string;
}): EventView {
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);

  // event.type is not a valid metric tag, so it will be added to the query only
  // in case the metric switch is disabled (for now).
  if (!isMetricsData) {
    conditions.setFilterValues('event.type', ['transaction']);
  }

  conditions.setFilterValues('transaction', [transactionName]);

  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: [...Object.values(SpanSortOthers), ...Object.values(SpanSortPercentiles)],
      query: conditions.formatString(),
      projects: [],
    },
    location
  );

  const sort = getSuspectSpanSortFromLocation(location);
  return eventView.withSorts([{field: sort.field, kind: 'desc'}]);
}

/**
 * For the totals view, we want to get some transaction level stats like
 * the number of transactions and the sum of the transaction duration.
 * This requires the removal of any aggregate conditions as they can result
 * in unexpected empty responses.
 */
export function getTotalsView(eventView: EventView): EventView {
  const totalsView = eventView.withColumns([
    {kind: 'function', function: ['count', '', undefined, undefined]},
  ]);

  const conditions = new MutableSearch(eventView.query);

  // filter out any aggregate conditions
  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) {
      conditions.removeFilter(field);
    }
  });

  totalsView.query = conditions.formatString();
  return totalsView;
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
  [SpanSortOthers.COUNT]: [
    'percentileArray(spans_exclusive_time, 0.75)',
    'count()',
    'count_unique(id)',
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

export function getExclusiveTimeDisplayedValue(value: string): string {
  return value.replace('exclusive', 'self');
}
