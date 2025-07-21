import type {Location} from 'history';

import {ExternalLink} from 'sentry/components/core/link';
import {wrapQueryInWildcards} from 'sentry/components/performance/searchBar';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t, tct} from 'sentry/locale';
import type {NewQuery, Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
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

export const DEFAULT_STATS_PERIOD = '14d';
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

export const USER_MISERY_TOOLTIP = tct(
  'A configurable score telling you how frequently users are frustrated by your application performance. [link:Learn more.]',
  {
    link: (
      <ExternalLink href="https://docs.sentry.io/product/performance/metrics/#user-misery" />
    ),
  }
);

const TOKEN_KEYS_SUPPORTED_IN_LIMITED_SEARCH = ['transaction'];

export enum PerformanceTerm {
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
  MOST_TIME_SPENT_DB_QUERIES = 'mostTimeSpentDbQueries',
  MOST_TIME_CONSUMING_RESOURCES = 'mostTimeConsumingResources',
  MOST_TIME_CONSUMING_DOMAINS = 'mostTimeConsumingDomains',
  HIGHEST_CACHE_MISS_RATE_TRANSACTIONS = 'highestCacheMissRateTransactions',
}

type TermFormatter = (organization: Organization) => string;

export const PERFORMANCE_TERMS: Record<PerformanceTerm, TermFormatter> = {
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
  mostTimeSpentDbQueries: () =>
    t('Database spans on which the application spent most of its total time.'),
  mostTimeConsumingResources: () =>
    t('Render blocking resources on which the application spent most of its total time.'),
  mostTimeConsumingDomains: () =>
    t('Outgoing HTTP domains on which the application spent most of its total time.'),
  highestCacheMissRateTransactions: () =>
    t('Transactions with the highest cache miss rate.'),
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

export function prepareQueryForLandingPage(searchQuery: any, withStaticFilters: any) {
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

export function generateGenericPerformanceEventView(
  location: Location,
  withStaticFilters: boolean,
  organization: Organization
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

  const widths = new Array(savedQuery.fields.length).fill(COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
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
    if (
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      WEB_VITAL_DETAILS[trendParameter.column] &&
      !organization.features.includes('performance-new-trends')
    ) {
      eventView.additionalConditions.addFilterValues('has', [trendParameter.column]);
    }
  }

  return eventView;
}

export function generateBackendPerformanceEventView(
  location: Location,
  withStaticFilters: boolean,
  useEap = false
): EventView {
  const {query} = location;

  const fields = [
    'team_key_transaction',
    'http.method',
    'transaction',
    'transaction.op',
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
    query: useEap ? 'is_transaction:true' : 'event.type:transaction',
    projects: [],
    fields,
    version: 2,
  };

  const widths = new Array(savedQuery.fields.length).fill(COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }
  savedQuery.orderby = decodeScalar(query.sort, '-tpm');

  const searchQuery = decodeScalar(query.query, '');
  savedQuery.query = prepareQueryForLandingPage(searchQuery, withStaticFilters);

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  if (useEap) {
    eventView.additionalConditions.addFilterValues('is_transaction', ['true']);
  } else {
    eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  }

  return eventView;
}

export function generateMobilePerformanceEventView(
  location: Location,
  projects: Project[],
  genericEventView: EventView,
  withStaticFilters: boolean,
  organization: Organization,
  useEap = false
): EventView {
  const {query} = location;

  const fields = [
    'team_key_transaction',
    'transaction',
    'transaction.op',
    'project',
    'tpm()',
    'p75(measurements.frames_slow_rate)',
    'p75(measurements.frames_frozen_rate)',
  ];
  if (organization.features.includes('mobile-vitals')) {
    fields.push('p75(measurements.time_to_initial_display)');
  }

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
      fields.push('p75(measurements.stall_percentage)');
    }
  }

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: useEap ? 'is_transaction:true' : 'event.type:transaction',
    projects: [],
    fields: [...fields, 'count_unique(user)', 'count_miserable(user)', 'user_misery()'],
    version: 2,
  };

  const widths = new Array(savedQuery.fields.length).fill(COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }
  savedQuery.orderby = decodeScalar(query.sort, '-tpm');

  const searchQuery = decodeScalar(query.query, '');
  savedQuery.query = prepareQueryForLandingPage(searchQuery, withStaticFilters);

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  if (useEap) {
    eventView.additionalConditions.addFilterValues('is_transaction', ['true']);
  } else {
    eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  }

  return eventView;
}

function generateFrontendPageloadPerformanceEventView(
  location: Location,
  withStaticFilters: boolean
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

  const widths = new Array(savedQuery.fields.length).fill(COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }
  savedQuery.orderby = decodeScalar(query.sort, '-tpm');

  const searchQuery = decodeScalar(query.query, '');
  savedQuery.query = prepareQueryForLandingPage(searchQuery, withStaticFilters);

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  eventView.additionalConditions.addFilterValues('transaction.op', ['pageload']);

  return eventView;
}

export function generateFrontendOtherPerformanceEventView(
  location: Location,
  withStaticFilters: boolean,
  useEap = false
): EventView {
  const {query} = location;

  const fields = [
    'team_key_transaction',
    'transaction',
    'transaction.op',
    'project',
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
    query: useEap ? 'is_transaction:true' : 'event.type:transaction',
    projects: [],
    fields,
    version: 2,
  };

  const widths = new Array(savedQuery.fields.length).fill(COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }
  savedQuery.orderby = decodeScalar(query.sort, '-tpm');

  const searchQuery = decodeScalar(query.query, '');
  savedQuery.query = prepareQueryForLandingPage(searchQuery, withStaticFilters);

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  if (useEap) {
    eventView.additionalConditions.addFilterValues('is_transaction', ['true']);
  } else {
    eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  }

  return eventView;
}

export function generatePerformanceEventView(
  location: Location,
  projects: Project[],
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

  const display = getCurrentLandingDisplay(location, projects, eventView);
  switch (display?.field) {
    case LandingDisplayField.FRONTEND_PAGELOAD:
      return generateFrontendPageloadPerformanceEventView(location, withStaticFilters);
    case LandingDisplayField.FRONTEND_OTHER:
      return generateFrontendOtherPerformanceEventView(location, withStaticFilters);
    case LandingDisplayField.BACKEND:
      return generateBackendPerformanceEventView(location, withStaticFilters);
    case LandingDisplayField.MOBILE:
      return generateMobilePerformanceEventView(
        location,
        projects,
        eventView,
        withStaticFilters,
        organization
      );
    default:
      return eventView;
  }
}

export function generatePerformanceVitalDetailView(location: Location): EventView {
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
    yAxis: [`p75(${vitalName})`],
  };

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }
  savedQuery.orderby = decodeScalar(query.sort, '-count');

  const searchQuery = decodeScalar(query.query, '');
  savedQuery.query = prepareQueryForLandingPage(searchQuery, false);

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  eventView.additionalConditions.addFilterValues('has', [vitalName]);

  return eventView;
}
