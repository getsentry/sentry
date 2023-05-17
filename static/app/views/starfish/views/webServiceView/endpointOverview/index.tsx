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
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {useQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import withApi from 'sentry/utils/withApi';
import FacetBreakdownBar from 'sentry/views/starfish/components/breakdownBar';
import Chart from 'sentry/views/starfish/components/chart';
import {FacetInsights} from 'sentry/views/starfish/components/facetInsights';
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

const EventsRequest = withApi(_EventsRequest);

const HTTP_SPAN_COLUMN_ORDER = [
  {
    key: 'description',
    name: 'URL',
    width: 400,
  },
  {
    key: 'throughput',
    name: 'Throughput',
    width: 350,
  },
  {
    key: 'p50_trend',
    name: 'p50 Trend',
    width: 200,
  },
  {
    key: 'p50(exclusive_time)',
    name: 'p50',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'transaction_count',
    name: 'Transactions',
    width: COL_WIDTH_UNDEFINED,
  },

  {
    key: 'total_exclusive_time',
    name: 'Total Time',
    width: COL_WIDTH_UNDEFINED,
  },
];

const DATABASE_SPAN_COLUMN_ORDER = [
  {
    key: 'description',
    name: 'Query',
    width: 400,
  },
  {
    key: 'domain',
    name: 'Table',
    width: 100,
  },
  {
    key: 'throughput',
    name: 'Throughput',
    width: 200,
  },
  {
    key: 'p75_trend',
    name: 'P75 Trend',
    width: 200,
  },
  {
    key: 'epm',
    name: 'Tpm',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p75',
    name: 'p75',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'total_time',
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
  } = useQueryMainTable({});

  const {data: dbAggregateData} = useQuery({
    queryKey: ['dbAggregates'],
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

  const combinedDbData = combineTableDataWithSparklineData(
    tableData,
    dbAggregateData,
    moment.duration(12, 'hours')
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
            yAxis={['tpm()', 'p50(transaction.duration)']}
            queryExtras={{dataset: 'metrics'}}
          >
            {({results, loading}) => {
              return (
                <Fragment>
                  <FlexRowContainer>
                    <FlexRowItem>
                      <SubHeader>{t('Throughput')}</SubHeader>
                      <Chart
                        statsPeriod={(statsPeriod as string) ?? '24h'}
                        height={150}
                        data={results?.[0] ? [results?.[0]] : []}
                        start=""
                        end=""
                        loading={loading}
                        utc={false}
                        stacked
                        isLineChart
                        disableXAxis
                        hideYAxisSplitLine
                        chartColors={[theme.charts.getColorPalette(0)[0]]}
                        grid={{
                          left: '0',
                          right: '0',
                          top: '8px',
                          bottom: '16px',
                        }}
                      />
                    </FlexRowItem>
                    <FlexRowItem>
                      <SubHeader>{t('p50(duration)')}</SubHeader>
                      <Chart
                        statsPeriod={(statsPeriod as string) ?? '24h'}
                        height={150}
                        data={results?.[1] ? [results?.[1]] : []}
                        start=""
                        end=""
                        loading={loading}
                        utc={false}
                        stacked
                        isLineChart
                        disableXAxis
                        hideYAxisSplitLine
                        chartColors={[theme.charts.getColorPalette(0)[1]]}
                        grid={{
                          left: '0',
                          right: '0',
                          top: '8px',
                          bottom: '16px',
                        }}
                      />
                    </FlexRowItem>
                  </FlexRowContainer>
                </Fragment>
              );
            }}
          </EventsRequest>
          <FacetBreakdownBar
            title={t('Where is time spent in this endpoint?')}
            transaction={transaction as string}
          />
          <SubHeader>{t('Sample Events')}</SubHeader>
          <SampleEvents eventView={eventView} />
          <SubHeader>{t('Correlations')}</SubHeader>
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
            onSelect={r => {
              browserHistory.push(
                `/starfish/span/${encodeURIComponent(r.group_id)}/?${qs.stringify({
                  transaction,
                })}`
              );
            }}
            isDataLoading={isTableDataLoading || isTableRefetching}
            data={combinedDbData as DataRow[]}
            columns={DATABASE_SPAN_COLUMN_ORDER}
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

const FlexRowContainer = styled('div')`
  display: flex;
  & > div:last-child {
    padding-right: ${space(1)};
  }
`;

const FlexRowItem = styled('div')`
  padding-right: ${space(4)};
  flex: 1;
`;
