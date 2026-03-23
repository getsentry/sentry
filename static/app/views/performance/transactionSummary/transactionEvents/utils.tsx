import type {Location, Query} from 'history';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {
  isAggregateField,
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {WebVital} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {
  decodeFilterFromLocation,
  filterToField,
  SpanOperationBreakdownFilter,
} from 'sentry/views/performance/transactionSummary/filter';
import {
  getTransactionSummaryBaseUrl,
  TransactionFilterOptions,
} from 'sentry/views/performance/transactionSummary/utils';

export enum EventsDisplayFilterName {
  P50 = 'p50',
  P75 = 'p75',
  P95 = 'p95',
  P99 = 'p99',
  P100 = 'p100',
}

type PercentileValues = Record<EventsDisplayFilterName, number>;

type EventsDisplayFilter = {
  label: string;
  name: EventsDisplayFilterName;
  query?: string[][];
  sort?: {field: string; kind: 'desc' | 'asc'};
};

type EventsFilterOptions = Record<EventsDisplayFilterName, EventsDisplayFilter>;

type EventsFilterPercentileValues = Record<
  Exclude<EventsDisplayFilterName, EventsDisplayFilterName.P100>,
  number
>;

export function getEventsFilterOptions(
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter,
  percentileValues?: EventsFilterPercentileValues
): EventsFilterOptions {
  const {p99, p95, p75, p50} = percentileValues
    ? percentileValues
    : {p99: 0, p95: 0, p75: 0, p50: 0};
  return {
    [EventsDisplayFilterName.P50]: {
      name: EventsDisplayFilterName.P50,
      query: p50 ? [['transaction.duration', `<=${p50.toFixed(0)}`]] : undefined,
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      label: t('p50'),
    },
    [EventsDisplayFilterName.P75]: {
      name: EventsDisplayFilterName.P75,
      query: p75 ? [['transaction.duration', `<=${p75.toFixed(0)}`]] : undefined,
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      label: t('p75'),
    },
    [EventsDisplayFilterName.P95]: {
      name: EventsDisplayFilterName.P95,
      query: p95 ? [['transaction.duration', `<=${p95.toFixed(0)}`]] : undefined,
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      label: t('p95'),
    },
    [EventsDisplayFilterName.P99]: {
      name: EventsDisplayFilterName.P99,
      query: p99 ? [['transaction.duration', `<=${p99.toFixed(0)}`]] : undefined,
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      label: t('p99'),
    },
    [EventsDisplayFilterName.P100]: {
      name: EventsDisplayFilterName.P100,
      label: t('p100'),
    },
  };
}

export function eventsRouteWithQuery({
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
  const pathname = `${getTransactionSummaryBaseUrl(organization, view)}/events/`;
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

  return EventsDisplayFilterName.P100;
}
export function decodeEventsDisplayFilterFromLocation(location: Location) {
  return stringToFilter(
    decodeScalar(location.query.showTransactions, EventsDisplayFilterName.P100)
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
  showTransaction: any
): EventsDisplayFilterName | undefined {
  switch (showTransaction) {
    case TransactionFilterOptions.OUTLIER:
      return EventsDisplayFilterName.P100;
    case TransactionFilterOptions.SLOW:
      return EventsDisplayFilterName.P95;
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

export function generateTransactionEventsEventView({
  location,
  transactionName,
}: {
  location: Location;
  organization: Organization;
  shouldUseEAP: boolean;
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

  const orderby = decodeScalar(location.query.sort, '-timestamp');

  // Default fields for relative span view
  const fields = [
    'id',
    'user.display',
    ...(orderby.endsWith('http.method') ? ['http.method'] : []),
    SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
    'transaction.duration',
    'trace',
    'timestamp',
  ];
  const breakdown = decodeFilterFromLocation(location);
  if (breakdown === SpanOperationBreakdownFilter.NONE) {
    fields.push(...SPAN_OP_BREAKDOWN_FIELDS);
  } else {
    fields.splice(2, 1, `spans.${breakdown}`);
  }
  const webVital = getWebVital(location);
  if (webVital) {
    fields.splice(3, 0, webVital);
  }

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields,
      query: conditions.formatString(),
      projects: [],
      orderby,
    },
    location
  );
}

export function getWebVital(location: Location): WebVital | undefined {
  const webVital = decodeScalar(location.query.webVital, '') as WebVital;
  if (Object.values(WebVital).includes(webVital)) {
    return webVital;
  }
  return undefined;
}
