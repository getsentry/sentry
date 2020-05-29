import {Location} from 'history';

import {t} from 'app/locale';
import {NewQuery} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';

export const DEFAULT_STATS_PERIOD = '24h';

export const COLUMN_TITLES = [
  'transaction',
  'project',
  'tpm',
  'p50',
  'p95',
  'failure rate',
  'apdex(300)',
  'users',
  'user misery',
];

export function generatePerformanceEventView(location: Location): EventView {
  const {query} = location;

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields: [
      'transaction',
      'project',
      'epm()',
      'p50()',
      'p95()',
      'failure_rate()',
      'apdex(300)',
      'count_unique(user)',
      'user_misery(300)',
    ],
    version: 2,
  };

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }
  savedQuery.orderby = decodeScalar(query.sort) || '-epm';

  const searchQuery = decodeScalar(query.query) || '';
  const conditions = Object.assign(tokenizeSearch(searchQuery), {
    'event.type': ['transaction'],
  });

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.query.length > 0) {
    conditions.transaction = [`*${conditions.query.join(' ')}*`];
    conditions.query = [];
  }
  savedQuery.query = stringifyQueryObject(conditions);

  return EventView.fromNewQueryWithLocation(savedQuery, location);
}
