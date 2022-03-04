import {Location} from 'history';

import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {NewQuery, Organization, Project, SelectValue} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getCurrentTrendParameter} from 'sentry/views/performance/trends/utils';

import {getCurrentLandingDisplay, LandingDisplayField} from './landing/utils';
import {
  getVitalDetailTableMehStatusFunction,
  getVitalDetailTablePoorStatusFunction,
  vitalNameFromLocation,
} from './vitalDetail/utils';

export const DEFAULT_STATS_PERIOD = '24h';
export const DEFAULT_PROJECT_THRESHOLD_METRIC = 'duration';
export const DEFAULT_PROJECT_THRESHOLD = 300;

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
  TPM = 'tpm',
  THROUGHPUT = 'throughput',
  FAILURE_RATE = 'failureRate',
  P50 = 'p50',
  P75 = 'p75',
  P95 = 'p95',
  P99 = 'p99',
  LCP = 'lcp',
  FCP = 'fcp',
  FID = 'fid',
  CLS = 'cls',
  STATUS_BREAKDOWN = 'statusBreakdown',
  DURATION_DISTRIBUTION = 'durationDistribution',
  USER_MISERY = 'userMisery',
  APDEX = 'apdex',
  APP_START_COLD = 'appStartCold',
  APP_START_WARM = 'appStartWarm',
  SLOW_FRAMES = 'slowFrames',
  FROZEN_FRAMES = 'frozenFrames',
  STALL_PERCENTAGE = 'stallPercentage',
  MOST_ISSUES = 'mostIssues',
  MOST_ERRORS = 'mostErrors',
  SLOW_HTTP_SPANS = 'slowHTTPSpans',
}

export type TooltipOption = SelectValue<string> & {
  tooltip: string;
};

export function getAxisOptions(organization: Organization): TooltipOption[] {
  return [
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APDEX),
      value: 'apdex()',
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
  backupOption?: AxisOption;
  isDistribution?: boolean;
  isLeftDefault?: boolean;
  isRightDefault?: boolean;
};

export function getFrontendAxisOptions(organization: Organization): AxisOption[] {
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

export function getFrontendOtherAxisOptions(organization: Organization): AxisOption[] {
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

export function getBackendAxisOptions(organization: Organization): AxisOption[] {
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
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APDEX),
      value: 'apdex()',
      label: t('Apdex'),
      field: 'apdex()',
    },
  ];
}

export function getMobileAxisOptions(organization: Organization): AxisOption[] {
  return [
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_COLD),
      value: `p50(measurements.app_start_cold)`,
      label: t('Cold Start Duration p50'),
      field: 'p50(measurements.app_start_cold)',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_COLD),
      value: `p75(measurements.app_start_cold)`,
      label: t('Cold Start Duration p75'),
      field: 'p75(measurements.app_start_cold)',
      isLeftDefault: true,
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_COLD),
      value: `p95(measurements.app_start_cold)`,
      label: t('Cold Start Duration p95'),
      field: 'p95(measurements.app_start_cold)',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_COLD),
      value: `p99(measurements.app_start_cold)`,
      label: t('Cold Start Duration p99'),
      field: 'p99(measurements.app_start_cold)',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
      value: 'app_start_cold_distribution',
      label: t('Cold Start Distribution'),
      field: 'measurements.app_start_cold',
      isDistribution: true,
      isRightDefault: true,
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_WARM),
      value: `p50(measurements.app_start_warm)`,
      label: t('Warm Start Duration p50'),
      field: 'p50(measurements.app_start_warm)',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_WARM),
      value: `p75(measurements.app_start_warm)`,
      label: t('Warm Start Duration p75'),
      field: 'p75(measurements.app_start_warm)',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_WARM),
      value: `p95(measurements.app_start_warm)`,
      label: t('Warm Start Duration p95'),
      field: 'p95(measurements.app_start_warm)',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_WARM),
      value: `p99(measurements.app_start_warm)`,
      label: t('Warm Start Duration p99'),
      field: 'p99(measurements.app_start_warm)',
    },
    {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
      value: 'app_start_warm_distribution',
      label: t('Warm Start Distribution'),
      field: 'measurements.app_start_warm',
      isDistribution: true,
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
  ];
}

type TermFormatter = (organization: Organization) => string;

export const PERFORMANCE_TERMS: Record<PERFORMANCE_TERM, TermFormatter> = {
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
  fid: () =>
    t(
      'First input delay (FID) is a web vital representing load for the first user interaction on a page.'
    ),
  cls: () =>
    t(
      'Cumulative layout shift (CLS) is a web vital measuring unexpected visual shifting a user experiences.'
    ),
  statusBreakdown: () =>
    t(
      'The breakdown of transaction statuses. This may indicate what type of failure it is.'
    ),
  durationDistribution: () =>
    t(
      'Distribution buckets counts of transactions at specifics times for your current date range'
    ),
  userMisery: () =>
    t(
      "User Misery is a score that represents the number of unique users who have experienced load times 4x the project's configured threshold. Adjust project threshold in project performance settings."
    ),
  apdex: () =>
    t(
      'Apdex is the ratio of both satisfactory and tolerable response times to all response times. To adjust the tolerable threshold, go to project performance settings.'
    ),
  appStartCold: () =>
    t('Cold start is a measure of the application start up time from scratch.'),
  appStartWarm: () =>
    t('Warm start is a measure of the application start up time while still in memory.'),
  slowFrames: () => t('The count of the number of slow frames in the transaction.'),
  frozenFrames: () => t('The count of the number of frozen frames in the transaction.'),
  mostErrors: () => t('Transactions with the most associated errors.'),
  mostIssues: () => t('The most instances of an issue for a related transaction.'),
  slowHTTPSpans: () => t('The transactions with the slowest spans of a certain type.'),
  stallPercentage: () =>
    t(
      'The percentage of the transaction duration in which the application is in a stalled state.'
    ),
};

export function getTermHelp(
  organization: Organization,
  term: keyof typeof PERFORMANCE_TERMS
): string {
  if (!PERFORMANCE_TERMS.hasOwnProperty(term)) {
    return '';
  }
  return PERFORMANCE_TERMS[term](organization);
}

function generateGenericPerformanceEventView(
  location: Location,
  isMetricsData: boolean
): EventView {
  const {query} = location;

  const fields = [
    'team_key_transaction',
    'transaction',
    'project',
    'tpm()',
    'p50()',
    'p95()',
    'failure_rate()',
    'apdex()',
    'count_unique(user)',
    'count_miserable(user)',
    'user_misery()',
  ];

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields,
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
  const conditions = new MutableSearch(searchQuery);

  // This is not an override condition since we want the duration to appear in the search bar as a default.
  if (!conditions.hasFilter('transaction.duration') && !isMetricsData) {
    conditions.setFilterValues('transaction.duration', ['<15m']);
  }

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.freeText.length > 0) {
    // the query here is a user entered condition, no need to escape it
    conditions.setFilterValues(
      'transaction',
      [`*${conditions.freeText.join(' ')}*`],
      false
    );
    conditions.freeText = [];
  }
  savedQuery.query = conditions.formatString();

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);
  // event.type is not a valid metric tag, so it will be added to the query only
  // in case the metric switch is disabled (for now).
  if (!isMetricsData) {
    eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  }

  if (query.trendParameter) {
    // projects and projectIds are not necessary here since trendParameter will always
    // be present in location and will not be determined based on the project type
    const trendParameter = getCurrentTrendParameter(location, [], []);
    if (Boolean(WEB_VITAL_DETAILS[trendParameter.column])) {
      eventView.additionalConditions.addFilterValues('has', [trendParameter.column]);
    }
  }

  return eventView;
}

function generateBackendPerformanceEventView(
  location: Location,
  isMetricsData: boolean
): EventView {
  const {query} = location;

  const fields = [
    'team_key_transaction',
    'transaction',
    'project',
    'transaction.op',
    'http.method',
    'tpm()',
    'p50()',
    'p95()',
    'failure_rate()',
    'apdex()',
    'count_unique(user)',
    'count_miserable(user)',
    'user_misery()',
  ];

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields,
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
  const conditions = new MutableSearch(searchQuery);

  // This is not an override condition since we want the duration to appear in the search bar as a default.
  if (!conditions.hasFilter('transaction.duration') && !isMetricsData) {
    conditions.setFilterValues('transaction.duration', ['<15m']);
  }

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.freeText.length > 0) {
    // the query here is a user entered condition, no need to escape it
    conditions.setFilterValues(
      'transaction',
      [`*${conditions.freeText.join(' ')}*`],
      false
    );
    conditions.freeText = [];
  }
  savedQuery.query = conditions.formatString();

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  // event.type is not a valid metric tag, so it will be added to the query only
  // in case the metric switch is disabled (for now).
  if (!isMetricsData) {
    eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  }

  return eventView;
}

function generateMobilePerformanceEventView(
  location: Location,
  projects: Project[],
  genericEventView: EventView,
  isMetricsData: boolean
): EventView {
  const {query} = location;

  const fields = [
    'team_key_transaction',
    'transaction',
    'project',
    'transaction.op',
    'tpm()',
    'p75(measurements.app_start_cold)',
    'p75(measurements.app_start_warm)',
    'p75(measurements.frames_slow_rate)',
    'p75(measurements.frames_frozen_rate)',
  ];

  // At this point, all projects are mobile projects.
  // If in addition to that, all projects are react-native projects,
  // then show the stall percentage as well.
  const projectIds = genericEventView.project;
  if (projectIds.length > 0 && projectIds[0] !== ALL_ACCESS_PROJECTS) {
    const selectedProjects = projects.filter(p =>
      projectIds.includes(parseInt(p.id, 10))
    );
    if (
      selectedProjects.length > 0 &&
      selectedProjects.every(project => project.platform === 'react-native')
    ) {
      // TODO(tonyx): remove these once the SDKs are ready
      fields.pop();
      fields.pop();

      fields.push('p75(measurements.stall_percentage)');
    }
  }

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields: [...fields, 'count_unique(user)', 'count_miserable(user)', 'user_misery()'],
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
  const conditions = new MutableSearch(searchQuery);

  // This is not an override condition since we want the duration to appear in the search bar as a default.
  if (!conditions.hasFilter('transaction.duration') && !isMetricsData) {
    conditions.setFilterValues('transaction.duration', ['<15m']);
  }

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.freeText.length > 0) {
    // the query here is a user entered condition, no need to escape it
    conditions.setFilterValues(
      'transaction',
      [`*${conditions.freeText.join(' ')}*`],
      false
    );
    conditions.freeText = [];
  }
  savedQuery.query = conditions.formatString();

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  // event.type is not a valid metric tag, so it will be added to the query only
  // in case the metric switch is disabled (for now).
  if (!isMetricsData) {
    eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  }

  return eventView;
}

function generateFrontendPageloadPerformanceEventView(
  location: Location,
  isMetricsData: boolean
): EventView {
  const {query} = location;

  const fields = [
    'team_key_transaction',
    'transaction',
    'project',
    'tpm()',
    'p75(measurements.fcp)',
    'p75(measurements.lcp)',
    'p75(measurements.fid)',
    'p75(measurements.cls)',
    'count_unique(user)',
    'count_miserable(user)',
    'user_misery()',
  ];

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields,
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
  const conditions = new MutableSearch(searchQuery);

  // This is not an override condition since we want the duration to appear in the search bar as a default.
  if (!conditions.hasFilter('transaction.duration') && !isMetricsData) {
    conditions.setFilterValues('transaction.duration', ['<15m']);
  }

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.freeText.length > 0) {
    // the query here is a user entered condition, no need to escape it
    conditions.setFilterValues(
      'transaction',
      [`*${conditions.freeText.join(' ')}*`],
      false
    );
    conditions.freeText = [];
  }
  savedQuery.query = conditions.formatString();

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  // event.type and transaction.op are not valid metric tags, so they will be added to the query only
  // in case the metric switch is disabled (for now).
  if (!isMetricsData) {
    eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
    eventView.additionalConditions.addFilterValues('transaction.op', ['pageload']);
  }

  return eventView;
}

function generateFrontendOtherPerformanceEventView(
  location: Location,
  isMetricsData: boolean
): EventView {
  const {query} = location;

  const fields = [
    'team_key_transaction',
    'transaction',
    'project',
    'transaction.op',
    'tpm()',
    'p50(transaction.duration)',
    'p75(transaction.duration)',
    'p95(transaction.duration)',
    'count_unique(user)',
    'count_miserable(user)',
    'user_misery()',
  ];

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields,
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
  const conditions = new MutableSearch(searchQuery);

  // This is not an override condition since we want the duration to appear in the search bar as a default.
  if (!conditions.hasFilter('transaction.duration') && !isMetricsData) {
    conditions.setFilterValues('transaction.duration', ['<15m']);
  }

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.freeText.length > 0) {
    // the query here is a user entered condition, no need to escape it
    conditions.setFilterValues(
      'transaction',
      [`*${conditions.freeText.join(' ')}*`],
      false
    );
    conditions.freeText = [];
  }
  savedQuery.query = conditions.formatString();

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  // event.type and !transaction.op are not valid metric tags, so they will be added to the query only
  // in case the metric switch is disabled (for now).
  if (!isMetricsData) {
    eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  }

  return eventView;
}

export function generatePerformanceEventView(
  location: Location,
  projects: Project[],
  {isTrends = false, isMetricsData = false} = {}
) {
  const eventView = generateGenericPerformanceEventView(location, isMetricsData);

  if (isTrends) {
    return eventView;
  }

  const display = getCurrentLandingDisplay(location, projects, eventView);
  switch (display?.field) {
    case LandingDisplayField.FRONTEND_PAGELOAD:
      return generateFrontendPageloadPerformanceEventView(location, isMetricsData);
    case LandingDisplayField.FRONTEND_OTHER:
      return generateFrontendOtherPerformanceEventView(location, isMetricsData);
    case LandingDisplayField.BACKEND:
      return generateBackendPerformanceEventView(location, isMetricsData);
    case LandingDisplayField.MOBILE:
      return generateMobilePerformanceEventView(
        location,
        projects,
        eventView,
        isMetricsData
      );
    default:
      return eventView;
  }
}

export function generatePerformanceVitalDetailView(
  location: Location,
  isMetricsData: boolean
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
      'team_key_transaction',
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
  const conditions = new MutableSearch(searchQuery);

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.freeText.length > 0) {
    // the query here is a user entered condition, no need to escape it
    conditions.setFilterValues(
      'transaction',
      [`*${conditions.freeText.join(' ')}*`],
      false
    );
    conditions.freeText = [];
  }
  savedQuery.query = conditions.formatString();

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  // event.type and has are not valid metric tags, so they will be added to the query only
  // in case the metric switch is disabled (for now).
  if (!isMetricsData) {
    eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
    eventView.additionalConditions.addFilterValues('has', [vitalName]);
  }

  return eventView;
}
