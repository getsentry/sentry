import {Location, Query} from 'history';

import {t} from 'sentry/locale';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';

import {filterToField, SpanOperationBreakdownFilter} from '../filter';
import {TransactionFilterOptions} from '../utils';

export enum EventsDisplayFilterName {
  p50 = 'p50',
  p75 = 'p75',
  p95 = 'p95',
  p99 = 'p99',
  p100 = 'p100',
}

export type PercentileValues = Record<EventsDisplayFilterName, number>;

export type EventsDisplayFilter = {
  label: string;
  name: EventsDisplayFilterName;
  query?: string[][];
  sort?: {field: string; kind: 'desc' | 'asc'};
};

export type EventsFilterOptions = {
  [name in EventsDisplayFilterName]: EventsDisplayFilter;
};

export type EventsFilterPercentileValues = {
  [name in Exclude<EventsDisplayFilterName, EventsDisplayFilterName.p100>]: number;
};

export function getEventsFilterOptions(
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter,
  percentileValues?: EventsFilterPercentileValues
): EventsFilterOptions {
  const {p99, p95, p75, p50} = percentileValues
    ? percentileValues
    : {p99: 0, p95: 0, p75: 0, p50: 0};
  return {
    [EventsDisplayFilterName.p50]: {
      name: EventsDisplayFilterName.p50,
      query: p50 ? [['transaction.duration', `<=${p50.toFixed(0)}`]] : undefined,
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      label: t('p50'),
    },
    [EventsDisplayFilterName.p75]: {
      name: EventsDisplayFilterName.p75,
      query: p75 ? [['transaction.duration', `<=${p75.toFixed(0)}`]] : undefined,
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      label: t('p75'),
    },
    [EventsDisplayFilterName.p95]: {
      name: EventsDisplayFilterName.p95,
      query: p95 ? [['transaction.duration', `<=${p95.toFixed(0)}`]] : undefined,
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      label: t('p95'),
    },
    [EventsDisplayFilterName.p99]: {
      name: EventsDisplayFilterName.p99,
      query: p99 ? [['transaction.duration', `<=${p99.toFixed(0)}`]] : undefined,
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      label: t('p99'),
    },
    [EventsDisplayFilterName.p100]: {
      name: EventsDisplayFilterName.p100,
      label: t('p100'),
    },
  };
}

export function eventsRouteWithQuery({
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
  const pathname = `/organizations/${orgSlug}/performance/summary/events/`;
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

function stringToFilter(option: string) {
  if (
    Object.values(EventsDisplayFilterName).includes(option as EventsDisplayFilterName)
  ) {
    return option as EventsDisplayFilterName;
  }

  return EventsDisplayFilterName.p100;
}
export function decodeEventsDisplayFilterFromLocation(location: Location) {
  return stringToFilter(
    decodeScalar(location.query.showTransactions, EventsDisplayFilterName.p100)
  );
}

export function filterEventsDisplayToLocationQuery(
  option: EventsDisplayFilterName,
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter
) {
  const eventsFilterOptions = getEventsFilterOptions(spanOperationBreakdownFilter);
  const kind = eventsFilterOptions[option].sort?.kind;
  const field = eventsFilterOptions[option].sort?.field;

  const query: {showTransactions: string; sort?: string} = {
    showTransactions: option,
  };
  if (kind && field) {
    query.sort = `${kind === 'desc' ? '-' : ''}${field}`;
  }
  return query;
}

export function mapShowTransactionToPercentile(
  showTransaction
): EventsDisplayFilterName | undefined {
  switch (showTransaction) {
    case TransactionFilterOptions.OUTLIER:
      return EventsDisplayFilterName.p100;
    case TransactionFilterOptions.SLOW:
      return EventsDisplayFilterName.p95;
    default:
      return undefined;
  }
}

export function mapPercentileValues(percentileData?: TableDataRow | null) {
  return {
    p100: percentileData?.['p100()'],
    p99: percentileData?.['p99()'],
    p95: percentileData?.['p95()'],
    p75: percentileData?.['p75()'],
    p50: percentileData?.['p50()'],
  } as PercentileValues;
}

export function getPercentilesEventView(eventView: EventView): EventView {
  const percentileColumns: QueryFieldValue[] = [
    {
      kind: 'function',
      function: ['p100', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['p99', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['p95', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['p75', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['p50', '', undefined, undefined],
    },
  ];

  return eventView.withColumns(percentileColumns);
}
