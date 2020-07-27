import {Location} from 'history';

import {t} from 'app/locale';
import {NewQuery, LightWeightOrganization, SelectValue} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';

import {PERFORMANCE_TERMS} from './constants';

export const DEFAULT_STATS_PERIOD = '24h';

export const COLUMN_TITLES = [
  'transaction',
  'project',
  'tpm',
  'p50',
  'p95',
  'failure rate',
  'apdex',
  'users',
  'user misery',
];

type TooltipOption = SelectValue<string> & {
  tooltip: string;
};

export function getAxisOptions(organization: LightWeightOrganization): TooltipOption[] {
  return [
    {
      tooltip: PERFORMANCE_TERMS.apdex,
      value: `apdex(${organization.apdexThreshold})`,
      label: t('Apdex'),
    },
    {
      tooltip: PERFORMANCE_TERMS.tpm,
      value: 'epm()',
      label: t('Transactions Per Minute'),
    },
    {
      tooltip: PERFORMANCE_TERMS.failureRate,
      value: 'failure_rate()',
      label: t('Failure Rate'),
    },
    {
      tooltip: PERFORMANCE_TERMS.p50,
      value: 'p50()',
      label: t('p50 Duration'),
    },
    {
      tooltip: PERFORMANCE_TERMS.p95,
      value: 'p95()',
      label: t('p95 Duration'),
    },
    {
      tooltip: PERFORMANCE_TERMS.p99,
      value: 'p99()',
      label: t('p99 Duration'),
    },
  ];
}

export function generatePerformanceEventView(
  organization: LightWeightOrganization,
  location: Location
): EventView {
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
      `apdex(${organization.apdexThreshold})`,
      'count_unique(user)',
      `user_misery(${organization.apdexThreshold})`,
    ],
    version: 2,
  };

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }
  savedQuery.orderby = decodeScalar(query.sort) || '-epm';

  const searchQuery = decodeScalar(query.query) || '';
  const conditions = tokenizeSearch(searchQuery);
  conditions.setTag('event.type', ['transaction']);

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.query.length > 0) {
    conditions.setTag('transaction', [`*${conditions.query.join(' ')}*`]);
    conditions.query = [];
  }
  savedQuery.query = stringifyQueryObject(conditions);

  return EventView.fromNewQueryWithLocation(savedQuery, location);
}
