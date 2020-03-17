import {Location} from 'history';

import {t} from 'app/locale';
import {NewQuery} from 'app/types';
import EventView from 'app/views/eventsV2/eventView';
import {decodeScalar} from 'app/views/eventsV2/utils';

export const DEFAULT_STATS_PERIOD = '24h';

export const PERFORMANCE_EVENT_VIEW: Readonly<NewQuery> = {
  id: undefined,
  name: t('Performance'),
  query: 'event.type:transaction',
  projects: [],
  fields: [
    'transaction',
    'project',
    'rpm()',
    'error_rate()',
    'p95()',
    'avg(transaction.duration)',
    'apdex()',
    'impact()',
  ],
  version: 2,
};

export function generatePerformanceQuery(location: Location): Readonly<NewQuery> {
  const extra: {[key: string]: string} = {};

  const {query} = location;

  const hasStartAndEnd = query?.start && query?.end;

  if (!query?.statsPeriod && !hasStartAndEnd) {
    extra.range = DEFAULT_STATS_PERIOD;
  }

  if (!query?.sort) {
    extra.orderby = '-rpm';
  } else {
    const sort = query?.sort;
    extra.orderby =
      Array.isArray(sort) && sort.length > 0
        ? sort[sort.length - 1]
        : typeof sort === 'string'
        ? sort
        : '-rpm';
  }

  if (query?.query) {
    const searchQuery = decodeScalar(query.query);
    if (searchQuery) {
      extra.query = `${PERFORMANCE_EVENT_VIEW.query} event.type:transaction transaction:"*${searchQuery}*"`;
    }
  }

  return Object.assign({}, PERFORMANCE_EVENT_VIEW, extra);
}

export function generatePerformanceEventView(location: Location): EventView {
  return EventView.fromNewQueryWithLocation(generatePerformanceQuery(location), location);
}
