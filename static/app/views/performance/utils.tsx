import {browserHistory} from 'react-router';
import {Theme} from '@emotion/react';
import {Location} from 'history';

import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import {LineChartSeries} from 'sentry/components/charts/lineChart';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {backend, frontend, mobile} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {
  NewQuery,
  Organization,
  OrganizationSummary,
  PageFilters,
  Project,
  ReleaseProject,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {trackAnalytics} from 'sentry/utils/analytics';
import {statsPeriodToDays} from 'sentry/utils/dates';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import EventView, {EventData} from 'sentry/utils/discover/eventView';
import {TRACING_FIELDS} from 'sentry/utils/discover/fields';
import {getDuration} from 'sentry/utils/formatters';
import getCurrentSentryReactTransaction from 'sentry/utils/getCurrentSentryReactTransaction';
import {decodeScalar} from 'sentry/utils/queryString';
import toArray from 'sentry/utils/toArray';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  NormalizedTrendsTransaction,
  TrendChangeType,
} from 'sentry/views/performance/trends/types';

import {DEFAULT_MAX_DURATION, getSelectedQueryKey} from './trends/utils';

export const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

export const UNPARAMETERIZED_TRANSACTION = '<< unparameterized >>'; // Represents 'other' transactions with high cardinality names that were dropped on the metrics dataset.
const UNPARAMETRIZED_TRANSACTION = '<< unparametrized >>'; // Old spelling. Can be deleted in the future when all data for this transaction name is gone.
export const EXCLUDE_METRICS_UNPARAM_CONDITIONS = `(!transaction:"${UNPARAMETERIZED_TRANSACTION}" AND !transaction:"${UNPARAMETRIZED_TRANSACTION}")`;
const SHOW_UNPARAM_BANNER = 'showUnparameterizedBanner';

const DEFAULT_CHART_HEIGHT = 200;
const X_AXIS_MARGIN_OFFSET = 23;

export enum DiscoverQueryPageSource {
  PERFORMANCE = 'performance',
  DISCOVER = 'discover',
}

export function createUnnamedTransactionsDiscoverTarget(props: {
  location: Location;
  organization: Organization;
  source?: DiscoverQueryPageSource;
}) {
  const fields =
    props.source === DiscoverQueryPageSource.DISCOVER
      ? ['transaction', 'project', 'transaction.source', 'epm()']
      : ['transaction', 'project', 'transaction.source', 'epm()', 'p50()', 'p95()'];

  const query: NewQuery = {
    id: undefined,
    name:
      props.source === DiscoverQueryPageSource.DISCOVER
        ? t('Unparameterized Transactions')
        : t('Performance - Unparameterized Transactions'),
    query: 'event.type:transaction transaction.source:"url"',
    projects: [],
    fields,
    version: 2,
  };

  const discoverEventView = EventView.fromNewQueryWithLocation(
    query,
    props.location
  ).withSorts([{field: 'epm', kind: 'desc'}]);
  const target = discoverEventView.getResultsViewUrlTarget(props.organization.slug);
  target.query[SHOW_UNPARAM_BANNER] = 'true';
  return target;
}

/**
 * Performance type can used to determine a default view or which specific field should be used by default on pages
 * where we don't want to wait for transaction data to return to determine how to display aspects of a page.
 */
export enum ProjectPerformanceType {
  ANY = 'any', // Fallback to transaction duration
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  FRONTEND_OTHER = 'frontend_other',
  MOBILE = 'mobile',
}

// The native SDK is equally used on clients and end-devices as on
// backend, the default view should be "All Transactions".
const FRONTEND_PLATFORMS: string[] = frontend.filter(
  platform =>
    // Next, Remix and Sveltekit have both, frontend and backend transactions.
    !['javascript-nextjs', 'javascript-remix', 'javascript-sveltekit'].includes(platform)
);
const BACKEND_PLATFORMS: string[] = backend.filter(platform => platform !== 'native');
const MOBILE_PLATFORMS: string[] = [...mobile];

export function platformToPerformanceType(
  projects: (Project | ReleaseProject)[],
  projectIds: readonly number[]
) {
  if (projectIds.length === 0 || projectIds[0] === ALL_ACCESS_PROJECTS) {
    return ProjectPerformanceType.ANY;
  }

  const selectedProjects = projects.filter(p =>
    projectIds.includes(parseInt(`${p.id}`, 10))
  );

  if (selectedProjects.length === 0 || selectedProjects.some(p => !p.platform)) {
    return ProjectPerformanceType.ANY;
  }

  const projectPerformanceTypes = new Set<ProjectPerformanceType>();

  selectedProjects.forEach(project => {
    if (FRONTEND_PLATFORMS.includes(project.platform ?? '')) {
      projectPerformanceTypes.add(ProjectPerformanceType.FRONTEND);
    }
    if (BACKEND_PLATFORMS.includes(project.platform ?? '')) {
      projectPerformanceTypes.add(ProjectPerformanceType.BACKEND);
    }
    if (MOBILE_PLATFORMS.includes(project.platform ?? '')) {
      projectPerformanceTypes.add(ProjectPerformanceType.MOBILE);
    }
  });

  const uniquePerformanceTypeCount = projectPerformanceTypes.size;

  if (!uniquePerformanceTypeCount || uniquePerformanceTypeCount > 1) {
    return ProjectPerformanceType.ANY;
  }
  const [PlatformKey] = projectPerformanceTypes;
  return PlatformKey;
}

/**
 * Used for transaction summary to determine appropriate columns on a page, since there is no display field set for the page.
 */
export function platformAndConditionsToPerformanceType(
  projects: Project[],
  eventView: EventView
) {
  const performanceType = platformToPerformanceType(projects, eventView.project);
  if (performanceType === ProjectPerformanceType.FRONTEND) {
    const conditions = new MutableSearch(eventView.query);
    const ops = conditions.getFilterValues('!transaction.op');
    if (ops.some(op => op === 'pageload')) {
      return ProjectPerformanceType.FRONTEND_OTHER;
    }
  }

  return performanceType;
}

/**
 * Used for transaction summary to check the view itself, since it can have conditions which would exclude it from having vitals aside from platform.
 */
export function isSummaryViewFrontendPageLoad(eventView: EventView, projects: Project[]) {
  return (
    platformAndConditionsToPerformanceType(projects, eventView) ===
    ProjectPerformanceType.FRONTEND
  );
}

export function isSummaryViewFrontend(eventView: EventView, projects: Project[]) {
  return (
    platformAndConditionsToPerformanceType(projects, eventView) ===
      ProjectPerformanceType.FRONTEND ||
    platformAndConditionsToPerformanceType(projects, eventView) ===
      ProjectPerformanceType.FRONTEND_OTHER
  );
}

export function getPerformanceLandingUrl(organization: OrganizationSummary): string {
  return `/organizations/${organization.slug}/performance/`;
}

export function getPerformanceTrendsUrl(organization: OrganizationSummary): string {
  return `/organizations/${organization.slug}/performance/trends/`;
}

export function getTransactionSearchQuery(location: Location, query: string = '') {
  return decodeScalar(location.query.query, query).trim();
}

export function handleTrendsClick({
  location,
  organization,
  projectPlatforms,
}: {
  location: Location;
  organization: Organization;
  projectPlatforms: string;
}) {
  trackAnalytics('performance_views.change_view', {
    organization,
    view_name: 'TRENDS',
    project_platforms: projectPlatforms,
  });

  const target = trendsTargetRoute({location, organization});

  browserHistory.push(normalizeUrl(target));
}

export function trendsTargetRoute({
  location,
  organization,
  initialConditions,
  additionalQuery,
}: {
  location: Location;
  organization: Organization;
  additionalQuery?: {[x: string]: string};
  initialConditions?: MutableSearch;
}) {
  const newQuery = {
    ...location.query,
    ...additionalQuery,
  };

  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);

  const modifiedConditions = initialConditions ?? new MutableSearch([]);

  // Trends on metrics don't need these conditions
  if (!organization.features.includes('performance-new-trends')) {
    // No need to carry over tpm filters to transaction summary
    if (conditions.hasFilter('tpm()')) {
      modifiedConditions.setFilterValues('tpm()', conditions.getFilterValues('tpm()'));
    } else {
      modifiedConditions.setFilterValues('tpm()', ['>0.01']);
    }

    if (conditions.hasFilter('transaction.duration')) {
      modifiedConditions.setFilterValues(
        'transaction.duration',
        conditions.getFilterValues('transaction.duration')
      );
    } else {
      modifiedConditions.setFilterValues('transaction.duration', [
        '>0',
        `<${DEFAULT_MAX_DURATION}`,
      ]);
    }
  }
  newQuery.query = modifiedConditions.formatString();

  return {pathname: getPerformanceTrendsUrl(organization), query: {...newQuery}};
}

export function removeTracingKeysFromSearch(
  currentFilter: MutableSearch,
  options: {excludeTagKeys: Set<string>} = {
    excludeTagKeys: new Set([
      // event type can be "transaction" but we're searching for issues
      'event.type',
      // the project is already determined by the transaction,
      // and issue search does not support the project filter
      'project',
    ]),
  }
) {
  currentFilter.getFilterKeys().forEach(tagKey => {
    const searchKey = tagKey.startsWith('!') ? tagKey.substring(1) : tagKey;
    // Remove aggregates and transaction event fields
    if (
      // aggregates
      searchKey.match(/\w+\(.*\)/) ||
      // transaction event fields
      TRACING_FIELDS.includes(searchKey) ||
      // tags that we don't want to pass to pass to issue search
      options.excludeTagKeys.has(searchKey)
    ) {
      currentFilter.removeFilter(tagKey);
    }
  });

  return currentFilter;
}

export function addRoutePerformanceContext(selection: PageFilters) {
  const transaction = getCurrentSentryReactTransaction();
  const days = statsPeriodToDays(
    selection.datetime.period,
    selection.datetime.start,
    selection.datetime.end
  );
  const oneDay = 86400;
  const seconds = Math.floor(days * oneDay);

  transaction?.setTag('query.period', seconds.toString());
  let groupedPeriod = '>30d';
  if (seconds <= oneDay) {
    groupedPeriod = '<=1d';
  } else if (seconds <= oneDay * 7) {
    groupedPeriod = '<=7d';
  } else if (seconds <= oneDay * 14) {
    groupedPeriod = '<=14d';
  } else if (seconds <= oneDay * 30) {
    groupedPeriod = '<=30d';
  }
  transaction?.setTag('query.period.grouped', groupedPeriod);
}

export function getTransactionName(location: Location): string | undefined {
  const {transaction} = location.query;

  return decodeScalar(transaction);
}

export function getPerformanceDuration(milliseconds: number) {
  return getDuration(milliseconds / 1000, milliseconds > 1000 ? 2 : 0, true);
}

export function getIsMultiProject(projects: readonly number[] | number[]) {
  if (!projects.length) {
    return true; // My projects
  }
  if (projects.length === 1 && projects[0] === ALL_ACCESS_PROJECTS) {
    return true; // All projects
  }
  return false;
}

export function getSelectedProjectPlatformsArray(
  location: Location,
  projects: Project[]
) {
  const projectQuery = location.query.project;
  const selectedProjectIdSet = new Set(toArray(projectQuery));

  const selectedProjectPlatforms = projects.reduce((acc: string[], project) => {
    if (selectedProjectIdSet.has(project.id)) {
      acc.push(project.platform ?? 'undefined');
    }

    return acc;
  }, []);

  return selectedProjectPlatforms;
}

export function getSelectedProjectPlatforms(location: Location, projects: Project[]) {
  const selectedProjectPlatforms = getSelectedProjectPlatformsArray(location, projects);
  return selectedProjectPlatforms.join(', ');
}

export function getProject(
  eventData: EventData,
  projects: Project[]
): Project | undefined {
  const projectSlug = (eventData?.project as string) || undefined;

  if (typeof projectSlug === undefined) {
    return undefined;
  }

  return projects.find(currentProject => currentProject.slug === projectSlug);
}

export function getProjectID(
  eventData: EventData,
  projects: Project[]
): string | undefined {
  return getProject(eventData, projects)?.id;
}

export function transformTransaction(
  transaction: NormalizedTrendsTransaction
): NormalizedTrendsTransaction {
  if (transaction && transaction.breakpoint) {
    return {
      ...transaction,
      breakpoint: transaction.breakpoint * 1000,
    };
  }
  return transaction;
}

export function getIntervalLine(
  theme: Theme,
  series: Series[],
  intervalRatio: number,
  label: boolean,
  transaction?: NormalizedTrendsTransaction,
  useRegressionFormat?: boolean
): LineChartSeries[] {
  if (!transaction || !series.length || !series[0].data || !series[0].data.length) {
    return [];
  }

  const transformedTransaction = transformTransaction(transaction);

  const seriesStart = parseInt(series[0].data[0].name as string, 10);
  const seriesEnd = parseInt(series[0].data.slice(-1)[0].name as string, 10);

  if (seriesEnd < seriesStart) {
    return [];
  }

  const periodLine: LineChartSeries = {
    data: [],
    color: theme.textColor,
    markLine: {
      data: [],
      label: {},
      lineStyle: {
        color: theme.textColor,
        type: 'dashed',
        width: label ? 1 : 2,
      },
      symbol: ['none', 'none'],
      tooltip: {
        show: false,
      },
    },
    seriesName: 'Baseline',
  };

  const periodLineLabel = {
    fontSize: 11,
    show: label,
    color: theme.textColor,
    silent: label,
  };

  const previousPeriod = {
    ...periodLine,
    markLine: {...periodLine.markLine},
    seriesName: 'Baseline',
  };
  const currentPeriod = {
    ...periodLine,
    markLine: {...periodLine.markLine},
    seriesName: 'Baseline',
  };
  const periodDividingLine = {
    ...periodLine,
    markLine: {...periodLine.markLine},
    seriesName: 'Baseline',
  };

  const seriesDiff = seriesEnd - seriesStart;
  const seriesLine = seriesDiff * intervalRatio + seriesStart;
  const {breakpoint} = transformedTransaction;

  const divider = breakpoint || seriesLine;

  previousPeriod.markLine.data = [
    [
      {value: 'Past', coord: [seriesStart, transformedTransaction.aggregate_range_1]},
      {coord: [divider, transformedTransaction.aggregate_range_1]},
    ],
  ];
  previousPeriod.markLine.tooltip = {
    formatter: () => {
      return [
        '<div class="tooltip-series tooltip-series-solo">',
        '<div>',
        `<span class="tooltip-label"><strong>${t('Past Baseline')}</strong></span>`,
        // p50() coerces the axis to be time based
        tooltipFormatter(transformedTransaction.aggregate_range_1, 'duration'),
        '</div>',
        '</div>',
        '<div class="tooltip-arrow"></div>',
      ].join('');
    },
  };
  currentPeriod.markLine.data = [
    [
      {value: 'Present', coord: [divider, transformedTransaction.aggregate_range_2]},
      {coord: [seriesEnd, transformedTransaction.aggregate_range_2]},
    ],
  ];
  currentPeriod.markLine.tooltip = {
    formatter: () => {
      return [
        '<div class="tooltip-series tooltip-series-solo">',
        '<div>',
        `<span class="tooltip-label"><strong>${t('Present Baseline')}</strong></span>`,
        // p50() coerces the axis to be time based
        tooltipFormatter(transformedTransaction.aggregate_range_2, 'duration'),
        '</div>',
        '</div>',
        '<div class="tooltip-arrow"></div>',
      ].join('');
    },
  };
  periodDividingLine.markLine = {
    data: [
      {
        xAxis: divider,
      },
    ],
    label: {show: false},
    lineStyle: {
      color: theme.textColor,
      type: 'solid',
      width: 2,
    },
    symbol: ['none', 'none'],
    tooltip: {
      show: false,
    },
    silent: true,
  };

  previousPeriod.markLine.label = {
    ...periodLineLabel,
    formatter: 'Past',
    position: 'insideStartBottom',
  };
  currentPeriod.markLine.label = {
    ...periodLineLabel,
    formatter: 'Present',
    position: 'insideEndBottom',
  };

  const additionalLineSeries = [previousPeriod, currentPeriod, periodDividingLine];

  // Apply new styles for statistical detector regression issue
  if (useRegressionFormat) {
    previousPeriod.markLine.label = {
      ...periodLineLabel,
      formatter: `Baseline ${getPerformanceDuration(
        transformedTransaction.aggregate_range_1
      )}`,
      position: 'insideStartBottom',
    };

    periodDividingLine.markLine.lineStyle = {
      ...periodDividingLine.markLine.lineStyle,
      color: theme.red300,
    };

    currentPeriod.markLine.lineStyle = {
      ...currentPeriod.markLine.lineStyle,
      color: theme.red300,
    };

    currentPeriod.markLine.label = {
      ...periodLineLabel,
      formatter: `Regressed ${getPerformanceDuration(
        transformedTransaction.aggregate_range_2
      )}`,
      position: 'insideEndBottom',
      color: theme.red300,
    };

    additionalLineSeries.push({
      seriesName: 'Regression Area',
      markLine: {},
      markArea: MarkArea({
        silent: true,
        itemStyle: {
          color: theme.red300,
          opacity: 0.2,
        },
        data: [
          [
            {
              xAxis: divider,
            },
            {xAxis: seriesEnd},
          ],
        ],
      }),
      data: [],
    });

    additionalLineSeries.push({
      seriesName: 'Baseline Axis Line',
      type: 'line',
      markLine:
        MarkLine({
          silent: true,
          label: {
            show: false,
          },
          lineStyle: {color: theme.green400, type: 'solid', width: 4},
          data: [
            // The line needs to be hard-coded to a pixel coordinate because
            // the lowest y-value is dynamic and 'min' doesn't work here
            [
              {xAxis: 'min', y: DEFAULT_CHART_HEIGHT - X_AXIS_MARGIN_OFFSET},
              {xAxis: breakpoint, y: DEFAULT_CHART_HEIGHT - X_AXIS_MARGIN_OFFSET},
            ],
          ],
        }) ?? {},
      data: [],
    });

    additionalLineSeries.push({
      seriesName: 'Regression Axis Line',
      type: 'line',
      markLine:
        MarkLine({
          silent: true,
          label: {
            show: false,
          },
          lineStyle: {color: theme.red300, type: 'solid', width: 4},
          data: [
            // The line needs to be hard-coded to a pixel coordinate because
            // the lowest y-value is dynamic and 'min' doesn't work here
            [
              {xAxis: breakpoint, y: DEFAULT_CHART_HEIGHT - X_AXIS_MARGIN_OFFSET},
              {xAxis: 'max', y: DEFAULT_CHART_HEIGHT - X_AXIS_MARGIN_OFFSET},
            ],
          ],
        }) ?? {},
      data: [],
    });
  }

  return additionalLineSeries;
}

export function getSelectedTransaction(
  location: Location,
  trendChangeType: TrendChangeType,
  transactions?: NormalizedTrendsTransaction[]
): NormalizedTrendsTransaction | undefined {
  const queryKey = getSelectedQueryKey(trendChangeType);
  const selectedTransactionName = decodeScalar(location.query[queryKey]);

  if (!transactions) {
    return undefined;
  }

  const selectedTransaction = transactions.find(
    transaction =>
      `${transaction.transaction}-${transaction.project}` === selectedTransactionName
  );

  if (selectedTransaction) {
    return selectedTransaction;
  }

  return transactions.length > 0 ? transactions[0] : undefined;
}
