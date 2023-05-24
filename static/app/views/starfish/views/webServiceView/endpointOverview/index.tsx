import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';
import * as qs from 'query-string';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import DatePageFilter from 'sentry/components/datePageFilter';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
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
import Chart from 'sentry/views/starfish/components/chart';
import {FacetInsights} from 'sentry/views/starfish/components/facetInsights';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {SampleEvents} from 'sentry/views/starfish/components/sampleEvents';
import EndpointTable from 'sentry/views/starfish/modules/APIModule/endpointTable';
import DatabaseTableView, {
  DataRow,
} from 'sentry/views/starfish/modules/databaseModule/databaseTableView';
import {
  getDbAggregatesQuery,
  useQueryMainTable,
} from 'sentry/views/starfish/modules/databaseModule/queries';
import combineTableDataWithSparklineData from 'sentry/views/starfish/utils/combineTableDataWithSparklineData';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {datetimeToClickhouseFilterTimestamps} from 'sentry/views/starfish/utils/dates';
import {SpanGroupBreakdownContainer} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

const EventsRequest = withApi(_EventsRequest);

const HTTP_SPAN_COLUMN_ORDER = [
  {
    key: 'description',
    name: 'URL',
    width: 400,
  },
  {
    key: 'throughput',
    name: 'Throughput (SPM)',
    width: 350,
  },
  {
    key: 'p50_trend',
    name: 'p50',
    width: 175,
  },
  {
    key: 'p95_trend',
    name: 'p95',
    width: 175,
  },
  {
    key: 'count_unique(transaction)',
    name: 'Transactions',
    width: COL_WIDTH_UNDEFINED,
  },

  {
    key: 'sum(span.self_time)',
    name: 'Total Time',
    width: COL_WIDTH_UNDEFINED,
  },
];

export default function EndpointOverview() {
  const location = useLocation();
  const organization = useOrganization();
  const theme = useTheme();

  const {endpoint: transaction, method, statsPeriod} = location.query;
  const pageFilter = usePageFilters();

  const {
    isLoading: isTableDataLoading,
    data: tableData,
    isRefetching: isTableRefetching,
  } = useQueryMainTable({transaction: (transaction as string) ?? '', limit: 8});

  const {data: dbAggregateData} = useQuery({
    queryKey: ['dbAggregates', transaction, pageFilter.selection.datetime],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getDbAggregatesQuery({
          datetime: pageFilter.selection.datetime,
          transaction,
        })}`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const aggregatesGroupedByQuery = {};
  dbAggregateData.forEach(({description, interval, count, p75}) => {
    if (description in aggregatesGroupedByQuery) {
      aggregatesGroupedByQuery[description].push({name: interval, count, p75});
    } else {
      aggregatesGroupedByQuery[description] = [{name: interval, count, p75}];
    }
  });

  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(
    pageFilter.selection.datetime
  );

  const combinedDbData = combineTableDataWithSparklineData(
    tableData,
    dbAggregateData,
    moment.duration(12, 'hours'),
    moment(start_timestamp),
    moment(end_timestamp)
  );

  const query = new MutableSearch([
    'has:http.method',
    'transaction.op:http.server',
    `transaction:${transaction}`,
    `http.method:${method}`,
  ]);

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
                        <MiniChartPanel title={t('Duration')}>
                          <Chart
                            statsPeriod={(statsPeriod as string) ?? '24h'}
                            height={110}
                            data={results?.[1] ? [results?.[1], results?.[2]] : []}
                            start=""
                            end=""
                            loading={loading}
                            utc={false}
                            isLineChart
                            disableXAxis
                            definedAxisTicks={2}
                            chartColors={theme.charts.getColorPalette(2)}
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
          <SampleEvents eventView={eventView} />
          <FacetInsights eventView={eventView} />
          <SubHeader>{t('HTTP Spans')}</SubHeader>
          <EndpointTable
            location={location}
            onSelect={r => {
              browserHistory.push(
                `/starfish/span/${encodeURIComponent(r.group_id)}/?${qs.stringify({
                  transaction,
                })}`
              );
            }}
            columns={HTTP_SPAN_COLUMN_ORDER}
            filterOptions={{
              action: '',
              domain: '',
              transaction: (transaction as string) ?? '',
              datetime: pageFilter.selection.datetime,
            }}
          />
          <SubHeader>{t('Database Spans')}</SubHeader>
          <DatabaseTableView
            location={location}
            data={combinedDbData as DataRow[]}
            isDataLoading={isTableDataLoading || isTableRefetching}
            onSelect={r => {
              browserHistory.push(
                `/starfish/span/${encodeURIComponent(r.group_id)}/?${qs.stringify({
                  transaction,
                })}`
              );
            }}
          />
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
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
