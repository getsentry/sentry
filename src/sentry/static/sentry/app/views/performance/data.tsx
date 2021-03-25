import {Location} from 'history';

import {t} from 'app/locale';
import {LightWeightOrganization, NewQuery, SelectValue} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';

import {getCurrentLandingDisplay, LandingDisplayField} from './landing/utils';
import {
  getVitalDetailTableMehStatusFunction,
  getVitalDetailTablePoorStatusFunction,
  vitalNameFromLocation,
} from './vitalDetail/utils';
import {FilterViews} from './landing';
import {getCurrentPerformanceView} from './utils';

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

export enum PERFORMANCE_TERM {
  APDEX = 'apdex',
  TPM = 'tpm',
  THROUGHPUT = 'throughput',
  FAILURE_RATE = 'failureRate',
  P50 = 'p50',
  P75 = 'p75',
  P95 = 'p95',
  P99 = 'p99',
  LCP = 'lcp',
  USER_MISERY = 'userMiseryPrototype',
  STATUS_BREAKDOWN = 'statusBreakdown',
  DURATION_DISTRIBUTION = 'durationDistribution',
}

export type TooltipOption = SelectValue<string> & {
  tooltip: string;
};

export function getAxisOptions(organization: LightWeightOrganization): TooltipOption[] {
  return [
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APDEX),
      value: `apdex(${organization.apdexThreshold})`,
      label: t('Apdex'),
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.TPM),
      value: 'tpm()',
      label: t('Transactions Per Minute'),
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE),
      value: 'failure_rate()',
      label: t('Failure Rate'),
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.P50),
      value: 'p50()',
      label: t('p50 Duration'),
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.P95),
      value: 'p95()',
      label: t('p95 Duration'),
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.P99),
      value: 'p99()',
      label: t('p99 Duration'),
    },
  ];
}

export type AxisOption = TooltipOption & {
  field: string;
  label: string;
  isDistribution?: boolean;
  isLeftDefault?: boolean;
  isRightDefault?: boolean;
};

export function getFrontendAxisOptions(
  organization: LightWeightOrganization
): AxisOption[] {
  return [
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.LCP),
      value: `p75(lcp)`,
      label: t('LCP p75'),
      field: 'p75(measurements.lcp)',
      isLeftDefault: true,
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
      value: 'lcp_distribution',
      label: t('LCP Distribution'),
      field: 'measurements.lcp',
      isDistribution: true,
      isRightDefault: true,
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.TPM),
      value: 'tpm()',
      label: t('Transactions Per Minute'),
      field: 'tpm()',
    },
  ];
}

export function getFrontendOtherAxisOptions(
  organization: LightWeightOrganization
): AxisOption[] {
  return [
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.P50),
      value: `p50()`,
      label: t('Duration p50'),
      field: 'p50(transaction.duration)',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.P75),
      value: `p75()`,
      label: t('Duration p75'),
      field: 'p75(transaction.duration)',
      isLeftDefault: true,
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.P95),
      value: `p95()`,
      label: t('Duration p95'),
      field: 'p95(transaction.duration)',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
      value: 'duration_distribution',
      label: t('Duration Distribution'),
      field: 'transaction.duration',
      isDistribution: true,
      isRightDefault: true,
    },
  ];
}

export function getBackendAxisOptions(
  organization: LightWeightOrganization
): AxisOption[] {
  return [
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.P50),
      value: `p50()`,
      label: t('Duration p50'),
      field: 'p50(transaction.duration)',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.P75),
      value: `p75()`,
      label: t('Duration p75'),
      field: 'p75(transaction.duration)',
      isLeftDefault: true,
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.P95),
      value: `p95()`,
      label: t('Duration p95'),
      field: 'p95(transaction.duration)',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.P99),
      value: `p99()`,
      label: t('Duration p99'),
      field: 'p99(transaction.duration)',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APDEX),
      value: `apdex(${organization.apdexThreshold})`,
      label: t('Apdex'),
      field: `apdex(${organization.apdexThreshold})`,
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.TPM),
      value: 'tpm()',
      label: t('Transactions Per Minute'),
      field: 'tpm()',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE),
      value: 'failure_rate()',
      label: t('Failure Rate'),
      field: 'failure_rate()',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
      value: 'duration_distribution',
      label: t('Duration Distribution'),
      field: 'transaction.duration',
      isDistribution: true,
      isRightDefault: true,
    },
  ];
}

type TermFormatter = (organization: LightWeightOrganization) => string;

const PERFORMANCE_TERMS: Record<PERFORMANCE_TERM, TermFormatter> = {
  apdex: () =>
    t(
      'Apdex is the ratio of both satisfactory and tolerable response times to all response times. To adjust the tolerable threshold, go to performance settings.'
    ),
  tpm: () => t('TPM is the number of recorded transaction events per minute.'),
  throughput: () =>
    t('Throughput is the number of recorded transaction events per minute.'),
  failureRate: () =>
    t(
      'Failure rate is the percentage of recorded transactions that had a known and unsuccessful status.'
    ),
  p50: () => t('p50 indicates the duration that 50% of transactions are faster than.'),
  p75: () => t('p75 indicates the duration that 75% of transactions are faster than.'),
  p95: () => t('p95 indicates the duration that 95% of transactions are faster than.'),
  p99: () => t('p99 indicates the duration that 99% of transactions are faster than.'),
  lcp: () =>
    t('Largest contentful paint (LCP) is a web vital meant to represent user load times'),
  userMiseryPrototype: organization =>
    t(
      "User Misery is a score that represents the number of unique users who have experienced load times 4x your organization's apdex threshold of %sms.",
      organization.apdexThreshold
    ),
  statusBreakdown: () =>
    t(
      'The breakdown of transaction statuses. This may indicate what type of failure it is.'
    ),
  durationDistribution: () =>
    t(
      'Distribution buckets counts of transactions at specifics times for your current date range'
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

function generateGenericPerformanceEventView(
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
      'key_transaction',
      'transaction',
      'project',
      'tpm()',
      'p50()',
      'p95()',
      'failure_rate()',
      `apdex(${organization.apdexThreshold})`,
      'count_unique(user)',
      `user_misery(${organization.apdexThreshold})`,
      `user_misery_prototype(${organization.apdexThreshold})`,
    ],
    version: 2,
  };

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }
  savedQuery.orderby = decodeScalar(query.sort, '-tpm');

  const searchQuery = decodeScalar(query.query, '');
  const conditions = tokenizeSearch(searchQuery);

  // This is not an override condition since we want the duration to appear in the search bar as a default.
  if (!conditions.hasTag('transaction.duration')) {
    conditions.setTagValues('transaction.duration', ['<15m']);
  }

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.query.length > 0) {
    conditions.setTagValues('transaction', [`*${conditions.query.join(' ')}*`]);
    conditions.query = [];
  }
  savedQuery.query = stringifyQueryObject(conditions);

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);
  eventView.additionalConditions.addTagValues('event.type', ['transaction']);
  return eventView;
}

function generateBackendPerformanceEventView(
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
      'key_transaction',
      'transaction',
      'transaction.op',
      'project',
      'tpm()',
      'p50()',
      'p95()',
      'failure_rate()',
      `apdex(${organization.apdexThreshold})`,
      'count_unique(user)',
      `user_misery(${organization.apdexThreshold})`,
      `user_misery_prototype(${organization.apdexThreshold})`,
    ],
    version: 2,
  };

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }
  savedQuery.orderby = decodeScalar(query.sort, '-tpm');

  const searchQuery = decodeScalar(query.query, '');
  const conditions = tokenizeSearch(searchQuery);

  // This is not an override condition since we want the duration to appear in the search bar as a default.
  if (!conditions.hasTag('transaction.duration')) {
    conditions.setTagValues('transaction.duration', ['<15m']);
  }

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.query.length > 0) {
    conditions.setTagValues('transaction', [`*${conditions.query.join(' ')}*`]);
    conditions.query = [];
  }
  savedQuery.query = stringifyQueryObject(conditions);

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);
  eventView.additionalConditions.addTagValues('event.type', ['transaction']);
  return eventView;
}

function generateFrontendPageloadPerformanceEventView(
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
      'key_transaction',
      'transaction',
      'project',
      'tpm()',
      'p75(measurements.fcp)',
      'p75(measurements.lcp)',
      'p75(measurements.fid)',
      'p75(measurements.cls)',
      'count_unique(user)',
      `user_misery(${organization.apdexThreshold})`,
      `user_misery_prototype(${organization.apdexThreshold})`,
    ],
    version: 2,
  };

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }
  savedQuery.orderby = decodeScalar(query.sort, '-tpm');

  const searchQuery = decodeScalar(query.query, '');
  const conditions = tokenizeSearch(searchQuery);

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.query.length > 0) {
    conditions.setTagValues('transaction', [`*${conditions.query.join(' ')}*`]);
    conditions.query = [];
  }
  savedQuery.query = stringifyQueryObject(conditions);

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);
  eventView.additionalConditions
    .addTagValues('event.type', ['transaction'])
    .addTagValues('transaction.op', ['pageload']);
  return eventView;
}

function generateFrontendOtherPerformanceEventView(
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
      'key_transaction',
      'transaction',
      'transaction.op',
      'project',
      'tpm()',
      'p50(transaction.duration)',
      'p75(transaction.duration)',
      'p95(transaction.duration)',
      'count_unique(user)',
      `user_misery(${organization.apdexThreshold})`,
      `user_misery_prototype(${organization.apdexThreshold})`,
    ],
    version: 2,
  };

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }
  savedQuery.orderby = decodeScalar(query.sort, '-tpm');

  const searchQuery = decodeScalar(query.query, '');
  const conditions = tokenizeSearch(searchQuery);

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.query.length > 0) {
    conditions.setTagValues('transaction', [`*${conditions.query.join(' ')}*`]);
    conditions.query = [];
  }
  savedQuery.query = stringifyQueryObject(conditions);

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);
  eventView.additionalConditions
    .addTagValues('event.type', ['transaction'])
    .addTagValues('!transaction.op', ['pageload']);
  return eventView;
}

export function generatePerformanceEventView(organization, location, projects) {
  const eventView = generateGenericPerformanceEventView(organization, location);
  const currentPerformanceView = getCurrentPerformanceView(location);
  if (
    !organization.features.includes('performance-landing-v2') ||
    currentPerformanceView === FilterViews.TRENDS
  ) {
    return eventView;
  }

  const display = getCurrentLandingDisplay(location, projects, eventView);
  switch (display?.field) {
    case LandingDisplayField.FRONTEND_PAGELOAD:
      return generateFrontendPageloadPerformanceEventView(organization, location);
    case LandingDisplayField.FRONTEND_OTHER:
      return generateFrontendOtherPerformanceEventView(organization, location);
    case LandingDisplayField.BACKEND:
      return generateBackendPerformanceEventView(organization, location);
    default:
      return eventView;
  }
}

export function generatePerformanceVitalDetailView(
  _organization: LightWeightOrganization,
  location: Location
): EventView {
  const {query} = location;

  const vitalName = vitalNameFromLocation(location);

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Vitals Performance Details'),
    query: 'event.type:transaction',
    projects: [],
    fields: [
      'key_transaction',
      'transaction',
      'project',
      'count_unique(user)',
      'count()',
      `p50(${vitalName})`,
      `p75(${vitalName})`,
      `p95(${vitalName})`,
      getVitalDetailTablePoorStatusFunction(vitalName),
      getVitalDetailTableMehStatusFunction(vitalName),
    ],
    version: 2,
  };

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }
  savedQuery.orderby = decodeScalar(query.sort, '-count');

  const searchQuery = decodeScalar(query.query, '');
  const conditions = tokenizeSearch(searchQuery);

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.query.length > 0) {
    conditions.setTagValues('transaction', [`*${conditions.query.join(' ')}*`]);
    conditions.query = [];
  }
  savedQuery.query = stringifyQueryObject(conditions);

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);
  eventView.additionalConditions
    .addTagValues('event.type', ['transaction'])
    .addTagValues('has', [vitalName]);
  return eventView;
}
