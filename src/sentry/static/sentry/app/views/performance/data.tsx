import React from 'react';
import {Location} from 'history';

import {IconStar} from 'app/icons';
import {t} from 'app/locale';
import {NewQuery, LightWeightOrganization, SelectValue} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';

export const DEFAULT_STATS_PERIOD = '24h';

export const COLUMN_TITLES = [
  <IconStar
    key="keyTransaction"
    color="yellow500"
    isSolid
    data-test-id="key-transaction-header"
  />,
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
      tooltip: getTermHelp(organization, 'apdex'),
      value: `apdex(${organization.apdexThreshold})`,
      label: t('Apdex'),
    },
    {
      tooltip: getTermHelp(organization, 'tpm'),
      value: 'epm()',
      label: t('Transactions Per Minute'),
    },
    {
      tooltip: getTermHelp(organization, 'failureRate'),
      value: 'failure_rate()',
      label: t('Failure Rate'),
    },
    {
      tooltip: getTermHelp(organization, 'p50'),
      value: 'p50()',
      label: t('p50 Duration'),
    },
    {
      tooltip: getTermHelp(organization, 'p95'),
      value: 'p95()',
      label: t('p95 Duration'),
    },
    {
      tooltip: getTermHelp(organization, 'p99'),
      value: 'p99()',
      label: t('p99 Duration'),
    },
  ];
}

type TermFormatter = (organization: LightWeightOrganization) => string;

const PERFORMANCE_TERMS: Record<string, TermFormatter> = {
  apdex: () =>
    t(
      'Apdex is the ratio of both satisfactory and tolerable response times to all response times.'
    ),
  tpm: () => t('TPM is the number of recorded transaction events per minute.'),
  failureRate: () =>
    t(
      'Failure rate is the percentage of recorded transactions that had a known and unsuccessful status.'
    ),
  p50: () => t('p50 indicates the duration that 50% of transactions are faster than.'),
  p95: () => t('p95 indicates the duration that 95% of transactions are faster than.'),
  p99: () => t('p99 indicates the duration that 99% of transactions are faster than.'),
  userMisery: organization =>
    t(
      "User misery is the percentage of users who are experiencing load times 4x your organization's apdex threshold of %sms.",
      organization.apdexThreshold
    ),
  statusBreakdown: () =>
    t(
      'The breakdown of transaction statuses. This may indicate what type of failure it is.'
    ),
};

export function getTermHelp(
  organization: LightWeightOrganization,
  term: keyof typeof PERFORMANCE_TERMS
): string {
  if (!PERFORMANCE_TERMS.hasOwnProperty(term)) {
    return '';
  }
  return PERFORMANCE_TERMS[term](organization);
}

export function generatePerformanceEventView(
  organization: LightWeightOrganization,
  location: Location
): EventView {
  const {query} = location;

  const keyTransactionFields = organization.features.includes('key-transactions')
    ? ['key_transaction']
    : [];

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields: [
      ...keyTransactionFields,
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
  conditions.setTagValues('event.type', ['transaction']);

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.query.length > 0) {
    conditions.setTagValues('transaction', [`*${conditions.query.join(' ')}*`]);
    conditions.query = [];
  }
  savedQuery.query = stringifyQueryObject(conditions);

  return EventView.fromNewQueryWithLocation(savedQuery, location);
}
