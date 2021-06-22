import {Location, Query} from 'history';

import {t} from 'app/locale';
import {decodeScalar} from 'app/utils/queryString';

import {filterToField, SpanOperationBreakdownFilter} from '../filter';

export enum EventsDisplayFilterName {
  NONE = 'none',
  FASTEST = 'fastest',
  SLOW = 'slow',
  OUTLIER = 'outlier',
  RECENT = 'recent',
}

export type EventsDisplayFilter = {
  sort: {kind: string; field: string};
  value: EventsDisplayFilterName;
  label: string;
  query?: string[][];
};

export function getEventsFilterOptions(
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter,
  p95: number
): EventsDisplayFilter[] {
  const spanOperationBreakdownFilterTextFragment =
    spanOperationBreakdownFilter !== SpanOperationBreakdownFilter.None
      ? `${spanOperationBreakdownFilter} Operations`
      : 'Transactions';
  return [
    {
      sort: {
        kind: 'asc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      value: EventsDisplayFilterName.FASTEST,
      label: t('Fastest %s', spanOperationBreakdownFilterTextFragment),
    },
    {
      query: [['transaction.duration', `<=${p95.toFixed(0)}`]],
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      value: EventsDisplayFilterName.SLOW,
      label: t('Slow %s (p95)', spanOperationBreakdownFilterTextFragment),
    },
    {
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      value: EventsDisplayFilterName.OUTLIER,
      label: t('Outlier %s (p100)', spanOperationBreakdownFilterTextFragment),
    },
    {
      sort: {kind: 'desc', field: 'timestamp'},
      value: EventsDisplayFilterName.RECENT,
      label: t('Recent Transactions'),
    },
  ];
}

export function eventsRouteWithQuery({
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

  return EventsDisplayFilterName.NONE;
}
export function decodeEventsDisplayFilterFromLocation(location: Location) {
  return stringToFilter(
    decodeScalar(location.query.showTransactions, EventsDisplayFilterName.NONE)
  );
}

export function filterEventsDisplayToLocationQuery(option: EventsDisplayFilterName) {
  return {
    showTransactions: option as string,
  };
}
