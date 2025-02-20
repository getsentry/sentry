import {useCallback, useMemo} from 'react';
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
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MultiSeriesEventsStats, Organization} from 'sentry/types/organization';
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
import {BarChartWidget} from 'sentry/views/dashboards/widgets/barChartWidget/barChartWidget';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {LineChartWidget} from 'sentry/views/dashboards/widgets/lineChartWidget/lineChartWidget';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
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

function PlaceholderWidget({title}: {title?: string}) {
  return (
    <Widget
      Title={<Widget.WidgetTitle title={title} />}
      Visualization={
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
          }}
        >
          Not implemented
        </div>
      }
    />
  );
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
                      <PlaceholderWidget title="Jobs" />
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
                  <PanelTable
                    headers={['Method', 'Route', 'Throughput', 'AVG', 'P95']}
                    isEmpty
                  />
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
`;

const JobsContainer = styled('div')`
  grid-area: jobs;
  min-width: 0;
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

function RequestsWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const theme = useTheme();

  const normalizedDateTime = useMemo(
    () => normalizeDateTimeParams(selection.datetime),
    [selection.datetime]
  );

  const {data, isLoading} = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...normalizedDateTime,
          interval: getInterval(selection.datetime, 'low'),
          dataset: 'spans',
          field: ['http.status_code', 'count(span.duration)'],
          yAxis: 'count(span.duration)',
          orderby: '-count(span.duration)',
          partial: 1,
          project: selection.projects,
          query: `has:http.status_code ${query}`.trim(),
          useRpc: 1,
          topEvents: 10,
        },
      },
    ],
    {staleTime: 0}
  );

  const getTimeSeries = useCallback(
    (codePrefix: string, color?: string): TimeSeries | undefined => {
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

      return {
        data: firstSeries.data.map(([time], index) => ({
          value: filteredSeries.reduce(
            (acc, series) => acc + series.data[index]?.[1][0]?.count!,
            0
          ),
          timestamp: new Date(time).toISOString(),
        })),
        field: `${codePrefix}xx`,
        meta: firstSeries.meta!,
        color,
      } satisfies TimeSeries;
    },
    [data]
  );

  return (
    <BarChartWidget
      isLoading={isLoading}
      title="Requests"
      timeSeries={[
        getTimeSeries('2', theme.gray200),
        getTimeSeries('5', theme.error),
      ].filter(series => !!series)}
      stacked
    />
  );
}

function DurationWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const normalizedDateTime = useMemo(
    () => normalizeDateTimeParams(selection.datetime),
    [selection.datetime]
  );

  const {data, isLoading} = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...normalizedDateTime,
          interval: getInterval(selection.datetime, 'low'),
          dataset: 'spans',
          yAxis: ['avg(span.duration)', 'p95(span.duration)'],
          orderby: 'avg(span.duration)',
          partial: 1,
          useRpc: 1,
          project: selection.projects,
          query: `has:http.status_code ${query}`.trim(),
        },
      },
    ],
    {staleTime: 0}
  );

  const getTimeSeries = useCallback(
    (field: string, color?: string): TimeSeries | undefined => {
      const series = data?.[field];
      if (!series) {
        return undefined;
      }

      return {
        data: series.data.map(([time, [value]]) => ({
          value: value?.count!,
          timestamp: new Date(time).toISOString(),
        })),
        field,
        meta: series.meta!,
        color,
      } satisfies TimeSeries;
    },
    [data]
  );

  return (
    <LineChartWidget
      isLoading={isLoading}
      title="Duration"
      timeSeries={[
        getTimeSeries('avg(span.duration)', CHART_PALETTE[1][0]),
        getTimeSeries('p95(span.duration)', CHART_PALETTE[1][1]),
      ].filter(series => !!series)}
    />
  );
}
