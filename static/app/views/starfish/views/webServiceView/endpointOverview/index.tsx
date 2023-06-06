import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {useQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import withApi from 'sentry/utils/withApi';
import {P95_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import {FacetInsights} from 'sentry/views/starfish/components/facetInsights';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {TransactionSamplesTable} from 'sentry/views/starfish/components/samplesTable/transactionSamplesTable';
import {ModuleName} from 'sentry/views/starfish/types';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {
  getSpanListQuery,
  getSpansTrendsQuery,
} from 'sentry/views/starfish/views/spans/queries';
import SpansTable, {
  SpanDataRow,
  SpanTrendDataRow,
} from 'sentry/views/starfish/views/spans/spansTable';
import {buildQueryConditions} from 'sentry/views/starfish/views/spans/spansView';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {SpanGroupBreakdownContainer} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

const SPANS_TABLE_LIMIT = 5;

const EventsRequest = withApi(_EventsRequest);

type State = {
  spansFilter: ModuleName;
};

export default function EndpointOverview() {
  const location = useLocation();
  const organization = useOrganization();
  const theme = useTheme();

  const {endpoint, method, statsPeriod} = location.query;
  const transaction = endpoint
    ? Array.isArray(endpoint)
      ? endpoint[0]
      : endpoint
    : undefined;
  const pageFilter = usePageFilters();

  const [state, setState] = useState<State>({spansFilter: ModuleName.ALL});

  const queryConditions = [
    'has:http.method',
    'transaction.op:http.server',
    `transaction:${transaction}`,
    `http.method:${method}`,
  ];

  const query = new MutableSearch(queryConditions);

  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Endpoint Overview'),
    query: query.formatString(),
    projects: [1],
    fields: [],
    version: 2,
  };

  function renderFailureRateChart() {
    return (
      <EventsRequest
        query={query.formatString()}
        includePrevious={false}
        partial
        interval="1h"
        includeTransformedData
        limit={1}
        environment={eventView.environment}
        project={eventView.project}
        period={eventView.statsPeriod}
        referrer="starfish-homepage-failure-rate"
        start={eventView.start}
        end={eventView.end}
        organization={organization}
        yAxis="equation|count_if(http.status_code,greaterOrEquals,500)/(count_if(http.status_code,equals,200)+count_if(http.status_code,greaterOrEquals,500))"
      >
        {eventData => {
          const transformedData: Series[] | undefined = eventData.timeseriesData?.map(
            series => ({
              data: series.data,
              seriesName: t('Error Rate'),
              color: CHART_PALETTE[5][3],
              silent: true,
            })
          );

          if (!transformedData) {
            return null;
          }

          return (
            <Fragment>
              <Chart
                statsPeriod={eventView.statsPeriod}
                height={80}
                data={transformedData}
                start={eventView.start as string}
                end={eventView.end as string}
                loading={eventData.loading}
                utc={false}
                grid={{
                  left: '0',
                  right: '0',
                  top: '8px',
                  bottom: '0',
                }}
                definedAxisTicks={2}
                isLineChart
                chartColors={theme.charts.getColorPalette(2)}
                disableXAxis
                aggregateOutputFormat="percentage"
              />
            </Fragment>
          );
        }}
      </EventsRequest>
    );
  }

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  return (
    <PageFiltersContainer>
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Endpoint Overview')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <SearchContainerWithFilterAndMetrics>
            <PageFilterBar condensed>
              <DatePageFilter alignDropdown="left" />
            </PageFilterBar>
          </SearchContainerWithFilterAndMetrics>

          <Layout.Main fullWidth>
            <SubHeader>{t('Endpoint URL')}</SubHeader>
            <pre>{`${method} ${transaction}`}</pre>
            <StyledRow minSize={200}>
              <ChartsContainer>
                <ChartsContainerItem>
                  <SpanGroupBreakdownContainer transaction={transaction as string} />
                </ChartsContainerItem>
                <ChartsContainerItem2>
                  <MiniChartPanel title={t('Error Rate')}>
                    {renderFailureRateChart()}
                  </MiniChartPanel>
                  <EventsRequest
                    query={query.formatString()}
                    includePrevious={false}
                    partial
                    limit={5}
                    interval="1h"
                    includeTransformedData
                    environment={eventView.environment}
                    project={eventView.project}
                    period={pageFilter.selection.datetime.period}
                    referrer="starfish-endpoint-overview"
                    start={pageFilter.selection.datetime.start}
                    end={pageFilter.selection.datetime.end}
                    organization={organization}
                    yAxis={[
                      'tpm()',
                      'p95(transaction.duration)',
                      'p50(transaction.duration)',
                    ]}
                    queryExtras={{dataset: 'metrics'}}
                  >
                    {({results, loading}) => {
                      return (
                        <Fragment>
                          <MiniChartPanel title={DataTitles.p95}>
                            <Chart
                              statsPeriod={(statsPeriod as string) ?? '24h'}
                              height={110}
                              data={results?.[2] ? [results?.[2]] : []}
                              start=""
                              end=""
                              loading={loading}
                              utc={false}
                              isLineChart
                              disableXAxis
                              definedAxisTicks={2}
                              chartColors={[P95_COLOR]}
                              grid={{
                                left: '0',
                                right: '0',
                                top: '8px',
                                bottom: '16px',
                              }}
                            />
                          </MiniChartPanel>
                          <MiniChartPanel title={t('Throughput')}>
                            <Chart
                              statsPeriod={(statsPeriod as string) ?? '24h'}
                              height={80}
                              data={results?.[0] ? [results?.[0]] : []}
                              start=""
                              end=""
                              loading={loading}
                              utc={false}
                              stacked
                              isLineChart
                              disableXAxis
                              definedAxisTicks={2}
                              chartColors={[theme.charts.getColorPalette(0)[0]]}
                              grid={{
                                left: '0',
                                right: '0',
                                top: '8px',
                                bottom: '16px',
                              }}
                            />
                          </MiniChartPanel>
                        </Fragment>
                      );
                    }}
                  </EventsRequest>
                </ChartsContainerItem2>
              </ChartsContainer>
            </StyledRow>
            <SubHeader>{t('Sample Events')}</SubHeader>
            <TransactionSamplesTable eventView={eventView} />
            <SegmentedControlContainer>
              <SegmentedControl
                size="xs"
                aria-label={t('Filter Spans')}
                value={state.spansFilter}
                onChange={key => setState({...state, spansFilter: key})}
              >
                <SegmentedControl.Item key="">{t('All Spans')}</SegmentedControl.Item>
                <SegmentedControl.Item key="http">{t('http')}</SegmentedControl.Item>
                <SegmentedControl.Item key="db">{t('db')}</SegmentedControl.Item>
              </SegmentedControl>
            </SegmentedControlContainer>
            <SpanMetricsTable filter={state.spansFilter} transaction={transaction} />
            <FacetInsights eventView={eventView} />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </PageFiltersContainer>
  );
}

function SpanMetricsTable({
  filter,
  transaction,
}: {
  filter: ModuleName;
  transaction: string | undefined;
}) {
  const location = useLocation();
  const pageFilter = usePageFilters();

  // TODO: Add transaction http method to query conditions as well, since transaction name alone is not unique
  const queryConditions = buildQueryConditions(filter || ModuleName.ALL, location);
  if (transaction) {
    queryConditions.push(`transaction = '${transaction}'`);
  }

  const query = getSpanListQuery(
    pageFilter.selection.datetime,
    queryConditions,
    'count',
    SPANS_TABLE_LIMIT
  );

  const {isLoading: areSpansLoading, data: spansData} = useQuery<SpanDataRow[]>({
    queryKey: ['spans', query],
    queryFn: () => fetch(`${HOST}/?query=${query}&format=sql`).then(res => res.json()),
    retry: false,
    refetchOnWindowFocus: false,
    initialData: [],
  });

  const groupIDs = spansData.map(({group_id}) => group_id);

  const {isLoading: areSpansTrendsLoading, data: spansTrendsData} = useQuery<
    SpanTrendDataRow[]
  >({
    queryKey: ['spansTrends'],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getSpansTrendsQuery(pageFilter.selection.datetime, groupIDs)}`
      ).then(res => res.json()),
    retry: false,
    refetchOnWindowFocus: false,
    initialData: [],
    enabled: groupIDs.length > 0,
  });

  return (
    <SpansTable
      moduleName={ModuleName.ALL}
      isLoading={areSpansLoading || areSpansTrendsLoading}
      spansData={spansData}
      orderBy="count"
      onSetOrderBy={() => undefined}
      spansTrendsData={spansTrendsData}
    />
  );
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
  margin: 0;
  margin-bottom: ${space(1)};
`;

const SearchContainerWithFilterAndMetrics = styled('div')`
  display: grid;
  grid-template-rows: auto auto auto;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr auto;
  }
`;

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const ChartsContainerItem = styled('div')`
  flex: 1.5;
`;

const ChartsContainerItem2 = styled('div')`
  flex: 1;
`;

const SegmentedControlContainer = styled('div')`
  margin-bottom: ${space(2)};
`;
