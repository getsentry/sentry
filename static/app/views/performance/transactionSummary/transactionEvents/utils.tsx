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
  name: EventsDisplayFilterName;
  sort?: {kind: 'desc' | 'asc'; field: string};
  label: string;
  query?: string[][];
};

export type EventsFilterOptions = {
  [name in EventsDisplayFilterName]: EventsDisplayFilter;
};

export function getEventsFilterOptions(
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter,
  p95?: number
): EventsFilterOptions {
  const spanOperationBreakdownFilterTextFragment =
    spanOperationBreakdownFilter !== SpanOperationBreakdownFilter.None
      ? `${spanOperationBreakdownFilter} Operations`
      : 'Transactions';
  return {
    [EventsDisplayFilterName.NONE]: {
      name: EventsDisplayFilterName.NONE,
      label: t('All %s', spanOperationBreakdownFilterTextFragment),
    },
    [EventsDisplayFilterName.FASTEST]: {
      name: EventsDisplayFilterName.FASTEST,
      sort: {
        kind: 'asc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      label: t('Fastest %s', spanOperationBreakdownFilterTextFragment),
    },

    [EventsDisplayFilterName.SLOW]: {
      name: EventsDisplayFilterName.SLOW,
      query: p95 ? [['transaction.duration', `<=${p95.toFixed(0)}`]] : [],
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      label: t('Slow %s (p95)', spanOperationBreakdownFilterTextFragment),
    },

    [EventsDisplayFilterName.OUTLIER]: {
      name: EventsDisplayFilterName.OUTLIER,
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      label: t('Outlier %s (p100)', spanOperationBreakdownFilterTextFragment),
    },

    [EventsDisplayFilterName.RECENT]: {
      name: EventsDisplayFilterName.RECENT,
      sort: {kind: 'desc', field: 'timestamp'},
      label: t('Recent Transactions'),
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
