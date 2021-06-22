import {Query} from 'history';

import {t} from 'app/locale';

import {filterToField, SpanOperationBreakdownFilter} from '../filter';

export enum EventsFilterOptionNames {
  FASTEST = 'fastest',
  SLOW = 'slow',
  OUTLIER = 'outlier',
  RECENT = 'recent',
}

export type EventsFilterOption = {
  sort: {kind: string; field: string};
  value: EventsFilterOptionNames;
  label: string;
  query?: string[][];
};

export function getEventsFilterOptions(
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter,
  p95: number
): EventsFilterOption[] {
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
      value: EventsFilterOptionNames.FASTEST,
      label: t('Fastest %s', spanOperationBreakdownFilterTextFragment),
    },
    {
      query: [['transaction.duration', `<=${p95.toFixed(0)}`]],
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      value: EventsFilterOptionNames.SLOW,
      label: t('Slow %s (p95)', spanOperationBreakdownFilterTextFragment),
    },
    {
      sort: {
        kind: 'desc',
        field: filterToField(spanOperationBreakdownFilter) || 'transaction.duration',
      },
      value: EventsFilterOptionNames.OUTLIER,
      label: t('Outlier %s (p100)', spanOperationBreakdownFilterTextFragment),
    },
    {
      sort: {kind: 'desc', field: 'timestamp'},
      value: EventsFilterOptionNames.RECENT,
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
