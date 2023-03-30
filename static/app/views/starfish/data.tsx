import {Location} from 'history';

import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {wrapQueryInWildcards} from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {NewQuery, Organization, Project, SelectValue} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getCurrentTrendParameter} from 'sentry/views/performance/trends/utils';

export const DEFAULT_STATS_PERIOD = '7d';
export const DEFAULT_PROJECT_THRESHOLD_METRIC = 'duration';
export const DEFAULT_PROJECT_THRESHOLD = 300;

export const COLUMN_TITLES = [
  'endpoint',
  'operation',
  'tpm',
  'p50(duration)',
  'p95(duration)',
  'users',
];

const TOKEN_KEYS_SUPPORTED_IN_LIMITED_SEARCH = ['transaction'];

export const getDefaultStatsPeriod = (organization: Organization) => {
  if (organization?.features?.includes('performance-landing-page-stats-period')) {
    return '14d';
  }
  return DEFAULT_STATS_PERIOD;
};

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
  TIME_TO_FULL_DISPLAY = 'timeToFullDisplay',
  TIME_TO_INITIAL_DISPLAY = 'timeToInitialDisplay',
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
  timeToFullDisplay: () =>
    t(
      'The time between application launch and complete display of all resources and views'
    ),
  timeToInitialDisplay: () =>
    t('The time it takes for an application to produce its first frame'),
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

function prepareQueryForLandingPage(searchQuery, withStaticFilters) {
  const conditions = new MutableSearch(searchQuery);

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.freeText.length > 0) {
    const parsedFreeText = conditions.freeText.join(' ');

    // the query here is a user entered condition, no need to escape it
    conditions.setFilterValues(
      'transaction',
      [wrapQueryInWildcards(parsedFreeText)],
      false
    );
    conditions.freeText = [];
  }
  if (withStaticFilters) {
    conditions.tokens = conditions.tokens.filter(
      token => token.key && TOKEN_KEYS_SUPPORTED_IN_LIMITED_SEARCH.includes(token.key)
    );
  }
  return conditions.formatString();
}

function generateGenericPerformanceEventView(
  location: Location,
  withStaticFilters: boolean,
  organization: Organization
): EventView {
  const {query} = location;

  const fields = [
    'team_key_transaction',
    'transaction',
    'http.method',
    'tpm()',
    'p50()',
    'p95()',
    'count_unique(user)',
    'project',
  ];

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction has:http.method',
    projects: [],
    fields,
    version: 2,
  };

  const widths = Array(savedQuery.fields.length).fill(COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = getDefaultStatsPeriod(organization);
  }
  savedQuery.orderby = decodeScalar(query.sort, '-tpm');

  const searchQuery = decodeScalar(query.query, '');
  savedQuery.query = prepareQueryForLandingPage(searchQuery, withStaticFilters);

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);
  eventView.additionalConditions.addFilterValues('event.type', ['transaction']);

  if (query.trendParameter) {
    // projects and projectIds are not necessary here since trendParameter will always
    // be present in location and will not be determined based on the project type
    const trendParameter = getCurrentTrendParameter(location, [], []);
    if (WEB_VITAL_DETAILS[trendParameter.column]) {
      eventView.additionalConditions.addFilterValues('has', [trendParameter.column]);
    }
  }

  return eventView;
}

export function generatePerformanceEventView(
  location: Location,
  _: Project[],
  {isTrends = false, withStaticFilters = false} = {},
  organization: Organization
) {
  const eventView = generateGenericPerformanceEventView(
    location,
    withStaticFilters,
    organization
  );
  if (isTrends) {
    return eventView;
  }

  return eventView;
}
