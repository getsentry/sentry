import {Location} from 'history';

import {COL_WIDTH_UNDEFINED} from 'app/components/gridEditable';
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
  FCP = 'fcp',
  USER_MISERY = 'userMisery',
  STATUS_BREAKDOWN = 'statusBreakdown',
  DURATION_DISTRIBUTION = 'durationDistribution',
  USER_MISERY_NEW = 'userMiseryNew',
  APDEX_NEW = 'apdexNew',
}

export type TooltipOption = SelectValue<string> & {
  tooltip: string;
};

export function getAxisOptions(organization: LightWeightOrganization): TooltipOption[] {
  let apdexOption: TooltipOption;
  if (organization.features.includes('project-transaction-threshold')) {
    apdexOption = {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APDEX_NEW),
      value: `apdex_new()`,
      label: t('Apdex'),
    };
  } else {
    apdexOption = {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APDEX),
      value: `apdex(${organization.apdexThreshold})`,
      label: t('Apdex'),
    };
  }
  return [
    apdexOption,
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
  backupOption?: AxisOption;
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
      backupOption: {
        tooltip: getTermHelp(organization, PERFORMANCE_TERM.FCP),
        value: `p75(fcp)`,
        label: t('FCP p75'),
        field: 'p75(measurements.fcp)',
      },
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
      value: 'lcp_distribution',
      label: t('LCP Distribution'),
      field: 'measurements.lcp',
      isDistribution: true,
      isRightDefault: true,
      backupOption: {
        tooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
        value: 'fcp_distribution',
        label: t('FCP Distribution'),
        field: 'measurements.fcp',
        isDistribution: true,
      },
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
  let apdexOption: AxisOption;
  if (organization.features.includes('project-transaction-threshold')) {
    apdexOption = {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APDEX),
      value: `apdex_new()`,
      label: t('Apdex'),
      field: `apdex_new()`,
    };
  } else {
    apdexOption = {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APDEX),
      value: `apdex(${organization.apdexThreshold})`,
      label: t('Apdex'),
      field: `apdex(${organization.apdexThreshold})`,
    };
  }
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
    apdexOption,
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
  fcp: () =>
    t('First contentful paint (FCP) is a web vital meant to represent user load times'),
  userMisery: organization =>
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
  userMiseryNew: () =>
    t(
      "User Misery is a score that represents the number of unique users who have experienced load times 4x the project's configured threshold. Adjust project threshold in project performance settings."
    ),
  apdexNew: () =>
    t(
      'Apdex is the ratio of both satisfactory and tolerable response times to all response times. To adjust the tolerable threshold, go to project performance settings.'
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

  const fields = [
    organization.features.includes('team-key-transactions')
      ? 'team_key_transaction'
      : 'key_transaction',
    'transaction',
    'project',
    'tpm()',
    'p50()',
    'p95()',
    'failure_rate()',
  ];

  const featureFields = organization.features.includes('project-transaction-threshold')
    ? [
        `apdex_new()`,
        'count_unique(user)',
        `count_miserable_new(user)`,
        `user_misery_new()`,
      ]
    : [
        `apdex(${organization.apdexThreshold})`,
        'count_unique(user)',
        `count_miserable(user,${organization.apdexThreshold})`,
        `user_misery(${organization.apdexThreshold})`,
      ];

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields: [...fields, ...featureFields],
    version: 2,
  };

  const widths = Array(savedQuery.fields.length).fill(COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

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

  const fields = [
    organization.features.includes('team-key-transactions')
      ? 'team_key_transaction'
      : 'key_transaction',
    'transaction',
    'project',
    'transaction.op',
    'http.method',
    'tpm()',
    'p50()',
    'p95()',
    'failure_rate()',
  ];

  const featureFields = organization.features.includes('project-transaction-threshold')
    ? [
        `apdex_new()`,
        'count_unique(user)',
        `count_miserable_new(user)`,
        `user_misery_new()`,
      ]
    : [
        `apdex(${organization.apdexThreshold})`,
        'count_unique(user)',
        `count_miserable(user,${organization.apdexThreshold})`,
        `user_misery(${organization.apdexThreshold})`,
      ];

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields: [...fields, ...featureFields],
    version: 2,
  };

  const widths = Array(savedQuery.fields.length).fill(COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

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

  const fields = [
    organization.features.includes('team-key-transactions')
      ? 'team_key_transaction'
      : 'key_transaction',
    'transaction',
    'project',
    'tpm()',
    'p75(measurements.fcp)',
    'p75(measurements.lcp)',
    'p75(measurements.fid)',
    'p75(measurements.cls)',
  ];

  const featureFields = organization.features.includes('project-transaction-threshold')
    ? ['count_unique(user)', `count_miserable_new(user)`, `user_misery_new()`]
    : [
        'count_unique(user)',
        `count_miserable(user,${organization.apdexThreshold})`,
        `user_misery(${organization.apdexThreshold})`,
      ];

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields: [...fields, ...featureFields],
    version: 2,
  };

  const widths = Array(savedQuery.fields.length).fill(COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

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

  const fields = [
    organization.features.includes('team-key-transactions')
      ? 'team_key_transaction'
      : 'key_transaction',
    'transaction',
    'project',
    'transaction.op',
    'tpm()',
    'p50(transaction.duration)',
    'p75(transaction.duration)',
    'p95(transaction.duration)',
  ];

  const featureFields = organization.features.includes('project-transaction-threshold')
    ? ['count_unique(user)', `count_miserable_new(user)`, `user_misery_new()`]
    : [
        'count_unique(user)',
        `count_miserable(user,${organization.apdexThreshold})`,
        `user_misery(${organization.apdexThreshold})`,
      ];

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields: [...fields, ...featureFields],
    version: 2,
  };

  const widths = Array(savedQuery.fields.length).fill(COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

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
  eventView.additionalConditions
    .addTagValues('event.type', ['transaction'])
    .addTagValues('!transaction.op', ['pageload']);
  return eventView;
}

export function generatePerformanceEventView(
  organization,
  location,
  projects,
  isTrends = false
) {
  let eventView = generateGenericPerformanceEventView(organization, location);
  if (isTrends) {
    return eventView;
  }

  const display = getCurrentLandingDisplay(location, projects, eventView);
  switch (display?.field) {
    case LandingDisplayField.FRONTEND_PAGELOAD:
      eventView = generateFrontendPageloadPerformanceEventView(organization, location);
      break;
    case LandingDisplayField.FRONTEND_OTHER:
      eventView = generateFrontendOtherPerformanceEventView(organization, location);
      break;
    case LandingDisplayField.BACKEND:
      eventView = generateBackendPerformanceEventView(organization, location);
      break;
    default:
      break;
  }

  if (organization.features.includes('team-key-transactions')) {
    return eventView.withTeams(['myteams']);
  } else {
    return eventView;
  }
}

export function generatePerformanceVitalDetailView(
  organization: LightWeightOrganization,
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
      organization.features.includes('team-key-transactions')
        ? 'team_key_transaction'
        : 'key_transaction',
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

  if (organization.features.includes('team-key-transactions')) {
    return eventView.withTeams(['myteams']);
  } else {
    return eventView;
  }
}
