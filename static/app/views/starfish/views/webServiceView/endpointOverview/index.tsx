import {Fragment, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueCategory, NewQuery} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import withApi from 'sentry/utils/withApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';
import {ERRORS_COLOR, P95_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import StarfishDatePicker from 'sentry/views/starfish/components/datePicker';
import {TransactionSamplesTable} from 'sentry/views/starfish/components/samplesTable/transactionSamplesTable';
import {ModuleName} from 'sentry/views/starfish/types';
import formatThroughput from 'sentry/views/starfish/utils/chartValueFormatters/formatThroughput';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {getDateConditions} from 'sentry/views/starfish/utils/getDateConditions';
import SpansTable from 'sentry/views/starfish/views/spans/spansTable';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import IssuesTable from 'sentry/views/starfish/views/webServiceView/endpointOverview/issuesTable';
import {SpanGroupBreakdownContainer} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

const SPANS_TABLE_LIMIT = 5;

const EventsRequest = withApi(_EventsRequest);

export type SampleFilter = 'ALL' | '500s';

type State = {
  samplesFilter: SampleFilter;
  spansFilter: ModuleName;
};

export default function EndpointOverview() {
  const location = useLocation();
  const organization = useOrganization();

  const {endpoint, 'http.method': httpMethod, statsPeriod} = location.query;
  const transaction = endpoint
    ? Array.isArray(endpoint)
      ? endpoint[0]
      : endpoint
    : undefined;
  const method = httpMethod
    ? Array.isArray(httpMethod)
      ? httpMethod[0]
      : httpMethod
    : undefined;
  const pageFilter = usePageFilters();

  const [state, setState] = useState<State>({
    spansFilter: ModuleName.ALL,
    samplesFilter: 'ALL',
  });
  const [issueFilter, setIssueFilter] = useState<IssueCategory | 'ALL'>('ALL');

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
    fields: ['tps()', 'p95(transaction.duration)', 'http_error_count()'],
    dataset: DiscoverDatasets.METRICS,
    start: pageFilter.selection.datetime.start ?? undefined,
    end: pageFilter.selection.datetime.end ?? undefined,
    range: pageFilter.selection.datetime.period ?? undefined,
    version: 2,
  };

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  const {data: totals, isLoading: isTotalsLoading} = useDiscoverQuery({
    eventView,
    orgSlug: organization.slug,
    location,
  });

  function renderSidebarCharts() {
    return (
      <EventsRequest
        query={query.formatString()}
        includePrevious={false}
        partial
        limit={5}
        interval={getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        )}
        includeTransformedData
        environment={eventView.environment}
        project={eventView.project}
        period={eventView.statsPeriod}
        referrer="starfish-endpoint-overview"
        start={eventView.start}
        end={eventView.end}
        organization={organization}
        yAxis={['tps()', 'http_error_count()', 'p95(transaction.duration)']}
        dataset={DiscoverDatasets.METRICS}
      >
        {({loading, results}) => {
          if (!results) {
            return null;
          }
          // Force label to be Requests
          const throughputResults = {seriesName: 'Requests', data: results[0].data};
          const percentileData: Series = {
            seriesName: t('Requests'),
            data: results[2].data,
          };
          return (
            <Fragment>
              <Header>
                <ChartLabel>{DataTitles.p95}</ChartLabel>
                <QuestionTooltip
                  size="sm"
                  position="right"
                  title={t(
                    'the value at which 5% of requests are greater than the threshold over a given time range'
                  )}
                />
              </Header>
              <ChartSummaryValue
                isLoading={isTotalsLoading}
                value={
                  defined(totals)
                    ? t(
                        '%sms',
                        (totals.data[0]['p95(transaction.duration)'] as number).toFixed(2)
                      )
                    : undefined
                }
              />
              <Chart
                statsPeriod={eventView.statsPeriod}
                height={80}
                data={[percentileData]}
                start={eventView.start as string}
                end={eventView.end as string}
                loading={loading}
                utc={false}
                grid={{
                  left: '8px',
                  right: '0',
                  top: '8px',
                  bottom: '0',
                }}
                disableXAxis
                definedAxisTicks={2}
                isLineChart
                chartColors={[P95_COLOR]}
                tooltipFormatterOptions={{
                  valueFormatter: value =>
                    tooltipFormatterUsingAggregateOutputType(value, 'duration'),
                }}
              />
              <Header>
                <ChartLabel>{DataTitles.throughput}</ChartLabel>
                <QuestionTooltip
                  size="sm"
                  position="right"
                  title={t(
                    'the number of requests made to this endpoint per second over a given time range'
                  )}
                />
              </Header>
              <ChartSummaryValue
                isLoading={isTotalsLoading}
                value={
                  defined(totals)
                    ? t('%s/s', (totals.data[0]['tps()'] as number).toFixed(2))
                    : undefined
                }
              />
              <Chart
                statsPeriod={(statsPeriod as string) ?? '24h'}
                height={80}
                data={[throughputResults]}
                start=""
                end=""
                loading={loading}
                utc={false}
                isLineChart
                definedAxisTicks={2}
                disableXAxis
                chartColors={[THROUGHPUT_COLOR]}
                aggregateOutputFormat="rate"
                grid={{
                  left: '8px',
                  right: '0',
                  top: '8px',
                  bottom: '0',
                }}
                tooltipFormatterOptions={{
                  valueFormatter: value => formatThroughput(value),
                }}
              />
              <SidebarSpacer />
              <Header>
                <ChartLabel>{DataTitles.errorCount}</ChartLabel>
                <QuestionTooltip
                  size="sm"
                  position="right"
                  title={t(
                    'the total number of requests that resulted in 5XX response codes over a given time range'
                  )}
                />
              </Header>
              <ChartSummaryValue
                isLoading={isTotalsLoading}
                value={
                  defined(totals)
                    ? tooltipFormatterUsingAggregateOutputType(
                        totals.data[0]['http_error_count()'] as number,
                        'integer'
                      )
                    : undefined
                }
              />
              <Chart
                statsPeriod={eventView.statsPeriod}
                height={80}
                data={[results[1]]}
                start={eventView.start as string}
                end={eventView.end as string}
                loading={loading}
                utc={false}
                grid={{
                  left: '8px',
                  right: '0',
                  top: '8px',
                  bottom: '0',
                }}
                definedAxisTicks={2}
                isLineChart
                chartColors={[ERRORS_COLOR]}
              />
              <SidebarSpacer />
            </Fragment>
          );
        }}
      </EventsRequest>
    );
  }

  const handleViewAllEventsClick = () => {
    const issuesQuery = new MutableSearch([
      ...(issueFilter === 'ALL' ? [] : [`issue.category:${issueFilter}`]),
      `transaction:${transaction}`,
      `http.method:${method}`,
    ]);
    browserHistory.push({
      pathname: `/issues/?${qs.stringify({
        ...getDateConditions(pageFilter.selection),
        query: issuesQuery.formatString(),
      })}`,
    });
  };

  useSynchronizeCharts();

  return (
    <PageFiltersContainer>
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: t('Web Service'),
                  to: normalizeUrl(`/organizations/${organization.slug}/starfish/`),
                },
                {
                  label: t('Endpoint Overview'),
                },
              ]}
            />
            <Layout.Title>{`${method} ${transaction}`}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <SearchContainerWithFilterAndMetrics>
            <PageFilterBar condensed>
              <StarfishDatePicker />
            </PageFilterBar>
          </SearchContainerWithFilterAndMetrics>

          <Layout.Main>
            <StyledRow minSize={200}>
              <SpanGroupBreakdownContainer
                transaction={transaction as string}
                // transactionMethod={method}
              />
            </StyledRow>
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
            <SpanMetricsTable
              filter={state.spansFilter}
              transaction={transaction}
              method={method}
            />
            <RowContainer>
              <SegmentedControlContainer>
                <SegmentedControl
                  size="xs"
                  aria-label={t('Filter events')}
                  value={state.samplesFilter}
                  onChange={key => setState({...state, samplesFilter: key})}
                >
                  <SegmentedControl.Item key="ALL">
                    {t('Sample Events')}
                  </SegmentedControl.Item>
                  <SegmentedControl.Item key="500s">{t('5XXs')}</SegmentedControl.Item>
                </SegmentedControl>
              </SegmentedControlContainer>
              <TransactionSamplesTable
                queryConditions={queryConditions}
                sampleFilter={state.samplesFilter}
              />
            </RowContainer>
            <SegmentedControlContainer>
              <SegmentedControl
                size="xs"
                aria-label={t('Filter issue types')}
                value={issueFilter}
                onChange={key => setIssueFilter(key)}
              >
                <SegmentedControl.Item key="ALL">{t('All Issues')}</SegmentedControl.Item>
                <SegmentedControl.Item key={IssueCategory.ERROR}>
                  {t('Errors Only')}
                </SegmentedControl.Item>
                <SegmentedControl.Item key={IssueCategory.PERFORMANCE}>
                  {t('Performance Only')}
                </SegmentedControl.Item>
              </SegmentedControl>
              <Button size="sm" onClick={handleViewAllEventsClick}>
                {t('View All')}
              </Button>
            </SegmentedControlContainer>
            <IssuesTable
              issueCategory={issueFilter === 'ALL' ? undefined : issueFilter}
              httpMethod={method as string}
              transactionName={transaction}
            />
          </Layout.Main>
          <Layout.Side>
            {renderSidebarCharts()}
            <SidebarSpacer />
          </Layout.Side>
        </Layout.Body>
      </Layout.Page>
    </PageFiltersContainer>
  );
}

function SpanMetricsTable({
  filter,
  transaction,
  method,
}: {
  filter: ModuleName;
  transaction: string | undefined;
  method?: string;
}) {
  return (
    <SpansTable
      moduleName={filter ?? ModuleName.ALL}
      sort={{
        field: 'time_spent_percentage(local)',
        kind: 'desc',
      }}
      endpoint={transaction}
      method={method}
      limit={SPANS_TABLE_LIMIT}
    />
  );
}

type ChartValueProps = {
  isLoading: boolean;
  value: React.ReactNode;
};

function ChartSummaryValue({isLoading, value}: ChartValueProps) {
  if (isLoading) {
    return <Placeholder height="24px" />;
  }

  return <ChartValue>{value}</ChartValue>;
}

const ChartValue = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
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

const RowContainer = styled('div')`
  padding-bottom: ${space(4)};
`;

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(4)};
`;

const SegmentedControlContainer = styled('div')`
  margin-bottom: ${space(2)};
  display: flex;
  justify-content: space-between;
  height: 32px;
  align-items: center;
`;

const ChartLabel = styled('div')`
  ${p => p.theme.text.cardTitle}
`;

const Header = styled('div')`
  padding: 0 ${space(1)} 0 0;
  min-height: 24px;
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
