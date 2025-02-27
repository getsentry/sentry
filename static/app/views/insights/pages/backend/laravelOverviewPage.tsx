import {Fragment, useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import pick from 'lodash/pick';

import type {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import {getInterval} from 'sentry/components/charts/utils';
import GroupList from 'sentry/components/issues/groupList';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {PanelTable} from 'sentry/components/panels/panelTable';
import TransactionNameSearchBar from 'sentry/components/performance/searchBar';
import Placeholder from 'sentry/components/placeholder';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {IconArrow, IconUser} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MultiSeriesEventsStats, Organization} from 'sentry/types/organization';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import getDuration from 'sentry/utils/duration/getDuration';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useBreakpoints} from 'sentry/utils/useBreakpoints';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {ViewTrendsButton} from 'sentry/views/insights/common/viewTrendsButton';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {BACKEND_LANDING_TITLE} from 'sentry/views/insights/pages/backend/settings';
import NoGroupsHandler from 'sentry/views/issueList/noGroupsHandler';
import {generateBackendPerformanceEventView} from 'sentry/views/performance/data';
import WidgetContainer from 'sentry/views/performance/landing/widgets/components/widgetContainer';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import {LegacyOnboarding} from 'sentry/views/performance/onboarding';
import {
  getTransactionSearchQuery,
  ProjectPerformanceType,
} from 'sentry/views/performance/utils';

import {InsightsBarChartWidget} from '../../common/components/insightsBarChartWidget';
import {InsightsLineChartWidget} from '../../common/components/insightsLineChartWidget';
import type {DiscoverSeries} from '../../common/queries/useDiscoverSeries';

function getFreeTextFromQuery(query: string) {
  const conditions = new MutableSearch(query);
  const transactionValues = conditions.getFilterValues('transaction');
  if (transactionValues.length) {
    return transactionValues[0];
  }
  if (conditions.freeText.length > 0) {
    // raw text query will be wrapped in wildcards in generatePerformanceEventView
    // so no need to wrap it here
    return conditions.freeText.join(' ');
  }
  return '';
}

export function LaravelOverviewPage() {
  const api = useApi();
  const organization = useOrganization();
  const location = useLocation();
  const onboardingProject = useOnboardingProject();
  const {selection} = usePageFilters();
  const navigate = useNavigate();

  const withStaticFilters = canUseMetricsData(organization);
  const eventView = generateBackendPerformanceEventView(
    location,
    withStaticFilters,
    organization
  );

  const showOnboarding = onboardingProject !== undefined;

  function handleSearch(searchQuery: string) {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(searchQuery).trim() || undefined,
        isDefaultQuery: false,
      },
    });
  }

  const derivedQuery = getTransactionSearchQuery(location, eventView.query);
  const getWidgetContainerProps = (widgetSetting: PerformanceWidgetSetting) => ({
    eventView,
    location,
    withStaticFilters,
    index: 0,
    chartCount: 1,
    allowedCharts: [widgetSetting],
    defaultChartSetting: widgetSetting,
    rowChartSettings: [widgetSetting],
    setRowChartSettings: () => {},
  });

  return (
    <Feature
      features="performance-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <BackendHeader
        headerTitle={BACKEND_LANDING_TITLE}
        headerActions={<ViewTrendsButton />}
      />
      <Layout.Body>
        <Layout.Main fullWidth>
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <ToolRibbon>
                <PageFilterBar condensed>
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </PageFilterBar>
                {!showOnboarding && (
                  <StyledTransactionNameSearchBar
                    organization={organization}
                    eventView={eventView}
                    onSearch={(query: string) => {
                      handleSearch(query);
                    }}
                    query={getFreeTextFromQuery(derivedQuery)!}
                  />
                )}
              </ToolRibbon>
            </ModuleLayout.Full>
            <ModuleLayout.Full>
              {!showOnboarding && (
                <PerformanceDisplayProvider
                  value={{performanceType: ProjectPerformanceType.BACKEND}}
                >
                  <WidgetGrid>
                    <RequestsContainer>
                      <RequestsWidget query={derivedQuery} />
                    </RequestsContainer>
                    <IssuesContainer>
                      <IssuesWidget
                        organization={organization}
                        location={location}
                        projectId={selection.projects[0]!}
                        query={derivedQuery}
                        api={api}
                      />
                    </IssuesContainer>
                    <DurationContainer>
                      <DurationWidget query={derivedQuery} />
                    </DurationContainer>
                    <JobsContainer>
                      <JobsWidget query={derivedQuery} />
                    </JobsContainer>
                    <QueriesContainer>
                      <WidgetContainer
                        {...getWidgetContainerProps(
                          PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES
                        )}
                        chartHeight={88}
                      />
                    </QueriesContainer>
                    <CachesContainer>
                      <WidgetContainer
                        {...getWidgetContainerProps(
                          PerformanceWidgetSetting.HIGHEST_CACHE_MISS_RATE_TRANSACTIONS
                        )}
                        chartHeight={88}
                      />
                    </CachesContainer>
                  </WidgetGrid>
                  <RoutesTable query={derivedQuery} />
                </PerformanceDisplayProvider>
              )}
              {showOnboarding && (
                <LegacyOnboarding
                  project={onboardingProject}
                  organization={organization}
                />
              )}
            </ModuleLayout.Full>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </Feature>
  );
}

const WidgetGrid = styled('div')`
  display: grid;
  gap: ${space(2)};
  padding-bottom: ${space(2)};

  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: repeat(6, 300px);
  grid-template-areas:
    'requests'
    'issues'
    'duration'
    'jobs'
    'queries'
    'caches';

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 300px 270px repeat(2, 300px);
    grid-template-areas:
      'requests duration'
      'issues issues'
      'jobs queries'
      'caches caches';
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 200px 200px repeat(1, 300px);
    grid-template-areas:
      'requests issues issues'
      'duration issues issues'
      'jobs queries caches';
  }
`;

const RequestsContainer = styled('div')`
  grid-area: requests;
  min-width: 0;
  & > * {
    height: 100% !important;
  }
`;

// TODO(aknaus): Remove css hacks and build custom IssuesWidget
const IssuesContainer = styled('div')`
  grid-area: issues;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  & > * {
    min-width: 0;
    overflow-y: auto;
    margin-bottom: 0 !important;
  }

  & ${PanelHeader} {
    position: sticky;
    top: 0;
    z-index: ${p => p.theme.zIndex.header};
  }
`;

const DurationContainer = styled('div')`
  grid-area: duration;
  min-width: 0;
  & > * {
    height: 100% !important;
  }
`;

const JobsContainer = styled('div')`
  grid-area: jobs;
  min-width: 0;
  & > * {
    height: 100% !important;
  }
`;

// TODO(aknaus): Remove css hacks and build custom QueryWidget
const QueriesContainer = styled('div')`
  grid-area: queries;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;

  & > * {
    min-width: 0;
  }
`;

// TODO(aknaus): Remove css hacks and build custom CacheWidget
const CachesContainer = styled('div')`
  grid-area: caches;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;

  & > * {
    min-width: 0;
  }
`;

const StyledTransactionNameSearchBar = styled(TransactionNameSearchBar)`
  flex: 2;
`;

type IssuesWidgetProps = {
  api: Client;
  location: Location;
  organization: Organization;
  projectId: number;
  query: string;
};

function IssuesWidget({
  organization,
  location,
  projectId,
  query,
  api,
}: IssuesWidgetProps) {
  const queryParams = {
    limit: '5',
    ...normalizeDateTimeParams(
      pick(location.query, [...Object.values(URL_PARAM), 'cursor'])
    ),
    query,
    sort: 'freq',
  };

  const breakpoints = useBreakpoints();

  function renderEmptyMessage() {
    const selectedTimePeriod = location.query.start
      ? null
      : // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        DEFAULT_RELATIVE_PERIODS[
          decodeScalar(location.query.statsPeriod, DEFAULT_STATS_PERIOD)
        ];
    const displayedPeriod = selectedTimePeriod
      ? selectedTimePeriod.toLowerCase()
      : t('given timeframe');

    return (
      <Panel style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
        <PanelBody>
          <NoGroupsHandler
            api={api}
            organization={organization}
            query={query}
            selectedProjectIds={[projectId]}
            groupIds={[]}
            emptyMessage={tct('No [issuesType] issues for the [timePeriod].', {
              issuesType: '',
              timePeriod: displayedPeriod,
            })}
          />
        </PanelBody>
      </Panel>
    );
  }

  // TODO(aknaus): Remove GroupList and use StreamGroup directly
  return (
    <GroupList
      orgSlug={organization.slug}
      queryParams={queryParams}
      canSelectGroups={false}
      renderEmptyMessage={renderEmptyMessage}
      withChart={breakpoints.xlarge}
      withPagination={false}
    />
  );
}

function usePageFilterChartParams() {
  const {selection} = usePageFilters();

  const normalizedDateTime = useMemo(
    () => normalizeDateTimeParams(selection.datetime),
    [selection.datetime]
  );

  return {
    ...normalizedDateTime,
    interval: getInterval(selection.datetime, 'low'),
    project: selection.projects,
  };
}

function RequestsWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams();
  const theme = useTheme();

  const {data, isLoading, error} = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: ['http.status_code', 'count(span.duration)'],
          yAxis: 'count(span.duration)',
          orderby: '-count(span.duration)',
          partial: 1,
          query: `span.op:http.server ${query}`.trim(),
          useRpc: 1,
          topEvents: 10,
        },
      },
    ],
    {staleTime: 0}
  );

  const getTimeSeries = useCallback(
    (codePrefix: string, color?: string): DiscoverSeries | undefined => {
      if (!data) {
        return undefined;
      }

      const filteredSeries = Object.keys(data)
        .filter(key => key.startsWith(codePrefix))
        .map(key => data[key]!);

      const firstSeries = filteredSeries[0];
      if (!firstSeries) {
        return undefined;
      }

      const field = `${codePrefix}xx`;

      return {
        data: firstSeries.data.map(([time], index) => ({
          name: new Date(time).toISOString(),
          value: filteredSeries.reduce(
            (acc, series) => acc + series.data[index]?.[1][0]?.count!,
            0
          ),
        })),
        seriesName: `${codePrefix}xx`,
        meta: {
          fields: {
            [field]: 'integer',
          },
          units: {},
        },
        color,
      } satisfies DiscoverSeries;
    },
    [data]
  );

  const timeSeries = useMemo(() => {
    return [getTimeSeries('2', theme.gray200), getTimeSeries('5', theme.error)].filter(
      series => !!series
    );
  }, [getTimeSeries, theme.error, theme.gray200]);

  return (
    <InsightsBarChartWidget
      title="Requests"
      isLoading={isLoading}
      error={error}
      series={timeSeries}
      stacked
    />
  );
}

function DurationWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams();

  const {data, isLoading, error} = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          yAxis: ['avg(span.duration)', 'p95(span.duration)'],
          orderby: 'avg(span.duration)',
          partial: 1,
          useRpc: 1,
          query: `span.op:http.server ${query}`.trim(),
        },
      },
    ],
    {staleTime: 0}
  );

  const getTimeSeries = useCallback(
    (field: string, color?: string): DiscoverSeries | undefined => {
      const series = data?.[field];
      if (!series) {
        return undefined;
      }

      return {
        data: series.data.map(([time, [value]]) => ({
          value: value?.count!,
          name: new Date(time).toISOString(),
        })),
        seriesName: field,
        meta: series.meta as EventsMetaType,
        color,
      } satisfies DiscoverSeries;
    },
    [data]
  );

  const timeSeries = useMemo(() => {
    return [
      getTimeSeries('avg(span.duration)', CHART_PALETTE[1][0]),
      getTimeSeries('p95(span.duration)', CHART_PALETTE[1][1]),
    ].filter(series => !!series);
  }, [getTimeSeries]);

  return (
    <InsightsLineChartWidget
      title="Duration"
      isLoading={isLoading}
      error={error}
      series={timeSeries}
    />
  );
}

function JobsWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams();
  const theme = useTheme();

  const {data, isLoading, error} = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spansMetrics',
          excludeOther: 0,
          per_page: 50,
          partial: 1,
          transformAliasToInputFormat: 1,
          query: `span.op:queue.process ${query}`.trim(),
          yAxis: ['trace_status_rate(ok)', 'spm()'],
        },
      },
    ],
    {staleTime: 0}
  );

  const intervalInMinutes = parsePeriodToHours(pageFilterChartParams.interval) * 60;

  const timeSeries = useMemo<DiscoverSeries[]>(() => {
    if (!data) {
      return [];
    }

    const okJobsRate = data['trace_status_rate(ok)'];
    const spansPerMinute = data['spm()'];

    if (!okJobsRate || !spansPerMinute) {
      return [];
    }

    const getSpansInTimeBucket = (index: number) => {
      const spansPerMinuteValue = spansPerMinute.data[index]?.[1][0]?.count! || 0;
      return spansPerMinuteValue * intervalInMinutes;
    };

    const [okJobs, failedJobs] = okJobsRate.data.reduce<[DiscoverSeries, DiscoverSeries]>(
      (acc, [time, [value]], index) => {
        const spansInTimeBucket = getSpansInTimeBucket(index);
        const okJobsRateValue = value?.count! || 0;
        const failedJobsRateValue = value?.count ? 1 - value.count : 0;

        acc[0].data.push({
          value: okJobsRateValue * spansInTimeBucket,
          name: new Date(time).toISOString(),
        });

        acc[1].data.push({
          value: failedJobsRateValue * spansInTimeBucket,
          name: new Date(time).toISOString(),
        });

        return acc;
      },
      [
        {
          data: [],
          color: theme.gray200,
          seriesName: 'Processed',
          meta: {
            fields: {
              Processed: 'integer',
            },
            units: {},
          },
        },
        {
          data: [],
          color: theme.error,
          seriesName: 'Failed',
          meta: {
            fields: {
              Failed: 'integer',
            },
            units: {},
          },
        },
      ]
    );

    return [okJobs, failedJobs];
  }, [data, intervalInMinutes, theme.error, theme.gray200]);

  return (
    <InsightsBarChartWidget
      title="Jobs"
      stacked
      isLoading={isLoading}
      error={error}
      series={timeSeries}
    />
  );
}

interface DiscoverQueryResponse {
  data: Array<{
    'avg(transaction.duration)': number;
    'count()': number;
    'count_unique(user)': number;
    'failure_rate()': number;
    'http.method': string;
    'p95()': number;
    transaction: string;
  }>;
}

interface RouteControllerMapping {
  'count(span.duration)': number;
  'span.description': string;
  transaction: string;
  'transaction.method': string;
}

const errorRateColorThreshold = {
  danger: 0.1,
  warning: 0.05,
} as const;

const getP95Threshold = (avg: number) => {
  return {
    danger: avg * 3,
    warning: avg * 2,
  };
};

const getCellColor = (value: number, thresholds: Record<string, number>) => {
  return Object.entries(thresholds).find(([_, threshold]) => value >= threshold)?.[0];
};

const PathCell = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(1)} ${space(2)};
  justify-content: center;
  gap: ${space(0.5)};
`;

const ControllerText = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  ${p => p.theme.overflowEllipsis};
  line-height: 1;
  width: 25vw;
`;

const Cell = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  overflow: hidden;
  white-space: nowrap;
  padding: ${space(1)} ${space(2)};

  &[data-color='danger'] {
    color: ${p => p.theme.red400};
  }
  &[data-color='warning'] {
    color: ${p => p.theme.yellow400};
  }
  &[data-align='right'] {
    text-align: right;
    justify-content: flex-end;
  }
`;

const HeaderCell = styled(Cell)`
  padding: 0;
`;

function RoutesTable({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams();
  const theme = useTheme();

  const transactionsRequest = useApiQuery<DiscoverQueryResponse>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'metrics',
          field: [
            'http.method',
            'transaction',
            'avg(transaction.duration)',
            'p95()',
            'failure_rate()',
            'count()',
            'count_unique(user)',
          ],
          query: `(transaction.op:http.server) event.type:transaction ${query}`,
          referrer: 'api.performance.landing-table',
          orderby: '-count()',
          per_page: 10,
        },
      },
    ],
    {staleTime: 0}
  );

  // Get the list of transactions from the first request
  const transactionPaths = useMemo(() => {
    return (
      transactionsRequest.data?.data.map(transactions => transactions.transaction) ?? []
    );
  }, [transactionsRequest.data]);

  // Add transaction filter to route controller request
  const routeControllersRequest = useApiQuery<{data: RouteControllerMapping[]}>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: [
            'span.description',
            'transaction',
            'transaction.method',
            'count(span.duration)',
          ],
          query: `transaction.op:http.server span.op:http.route transaction:[${
            transactionPaths.map(transactions => `"${transactions}"`).join(',') || '""'
          }]`,
          referrer: 'api.explore.spans-aggregates-table',
          sort: '-transaction',
          per_page: 25,
        },
      },
    ],
    {
      staleTime: 0,
      // Only fetch after we have the transactions data and there are transactions to look up
      enabled: !!transactionsRequest.data?.data && transactionPaths.length > 0,
    }
  );

  const tableData = useMemo(() => {
    if (!transactionsRequest.data?.data) {
      return [];
    }

    // Create a mapping of transaction path to controller
    const controllerMap = new Map(
      routeControllersRequest.data?.data.map(item => [
        item.transaction,
        item['span.description'],
      ])
    );

    return transactionsRequest.data.data.map(transaction => ({
      method: transaction['http.method'],
      path: transaction.transaction,
      requests: transaction['count()'],
      avg: transaction['avg(transaction.duration)'],
      p95: transaction['p95()'],
      errorRate: transaction['failure_rate()'],
      users: transaction['count_unique(user)'],
      controller: controllerMap.get(transaction.transaction),
    }));
  }, [transactionsRequest.data, routeControllersRequest.data]);

  return (
    <PanelTable
      headers={[
        'Method',
        'Path',
        <HeaderCell key="requests">
          <IconArrow direction="down" />
          Requests
        </HeaderCell>,
        'Error Rate',
        'AVG',
        'P95',
        <HeaderCell key="users" data-align="right">
          Users
        </HeaderCell>,
      ]}
      isLoading={transactionsRequest.isLoading}
      isEmpty={!tableData || tableData.length === 0}
    >
      {tableData?.map(transaction => {
        const p95Color = getCellColor(transaction.p95, getP95Threshold(transaction.avg));
        const errorRateColor = getCellColor(
          transaction.errorRate,
          errorRateColorThreshold
        );

        return (
          <Fragment key={transaction.method + transaction.path}>
            <Cell>{transaction.method}</Cell>
            <PathCell>
              {transaction.path}
              {routeControllersRequest.isLoading ? (
                <Placeholder height={theme.fontSizeSmall} width="25vw" />
              ) : (
                transaction.controller && (
                  <ControllerText>{transaction.controller}</ControllerText>
                )
              )}
            </PathCell>
            <Cell>{formatAbbreviatedNumber(transaction.requests)}</Cell>
            <Cell data-color={errorRateColor}>
              {(transaction.errorRate * 100).toFixed(2)}%
            </Cell>
            <Cell>{getDuration(transaction.avg / 1000, 2, true, true)}</Cell>
            <Cell data-color={p95Color}>
              {getDuration(transaction.p95 / 1000, 2, true, true)}
            </Cell>
            <Cell data-align="right">
              {formatAbbreviatedNumber(transaction.users)}
              <IconUser size="xs" />
            </Cell>
          </Fragment>
        );
      })}
    </PanelTable>
  );
}
