import type {Location, Query} from 'history';
import pick from 'lodash/pick';

import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {isAggregateField} from 'sentry/utils/discover/fields';
import type {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

import type {SpanSort, SpanSortOption} from './types';
import {SpanSortOthers, SpanSortPercentiles} from './types';

export function generateSpansRoute({
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
  const sort = eventView.sorts.length ? eventView.sorts[0]!.field : DEFAULT_SORT;
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
}: {
  location: Location;
  transactionName: string;
}): EventView {
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);

  conditions.setFilterValues('event.type', ['transaction']);
  conditions.setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) {
      conditions.removeFilter(field);
    }
  });

  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: [
        ...Object.values(SpanSortOthers),
        ...Object.values(SpanSortPercentiles),
        'trace',
      ],
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
    {kind: 'function', function: ['sum', 'transaction.duration', undefined, undefined]},
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
