import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import Placeholder from 'sentry/components/placeholder';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueCategory, NewQuery} from 'sentry/types';
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
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';
import {ERRORS_COLOR, P95_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import {TransactionSamplesTable} from 'sentry/views/starfish/components/samplesTable/transactionSamplesTable';
import {ModuleName} from 'sentry/views/starfish/types';
import SpansTable from 'sentry/views/starfish/views/spans/spansTable';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import IssuesTable from 'sentry/views/starfish/views/webServiceView/endpointOverview/issuesTable.tsx';
import {SpanGroupBreakdownContainer} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

const SPANS_TABLE_LIMIT = 5;

const EventsRequest = withApi(_EventsRequest);

type State = {
  spansFilter: ModuleName;
};

export default function EndpointOverview() {
  const location = useLocation();
  const organization = useOrganization();

  const {endpoint, method, statsPeriod} = location.query;
  const transaction = endpoint
    ? Array.isArray(endpoint)
      ? endpoint[0]
      : endpoint
    : undefined;
  const pageFilter = usePageFilters();

  const [state, setState] = useState<State>({spansFilter: ModuleName.ALL});
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
    projects: [1],
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
        interval="1h"
        includeTransformedData
        environment={eventView.environment}
        project={eventView.project}
        period={eventView.statsPeriod}
        referrer="starfish-endpoint-overview"
        start={eventView.start}
        end={eventView.end}
        organization={organization}
        yAxis={['tps()', 'p95(transaction.duration)', 'http_error_count()']}
        dataset={DiscoverDatasets.METRICS}
      >
        {({loading, results}) => {
          if (!results) {
            return null;
          }
          return (
            <Fragment>
              <Header>
                <ChartLabel>{t('Throughput Per Second')}</ChartLabel>
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
                data={[results[0]]}
                start=""
                end=""
                loading={loading}
                utc={false}
                isLineChart
                definedAxisTicks={2}
                disableXAxis
                chartColors={[THROUGHPUT_COLOR]}
                grid={{
                  left: '8px',
                  right: '0',
                  top: '8px',
                  bottom: '0',
                }}
                tooltipFormatterOptions={{
                  valueFormatter: value => t('%s/sec', value.toFixed(2)),
                }}
              />
              <SidebarSpacer />
              <Header>
                <ChartLabel>{DataTitles.p95}</ChartLabel>
              </Header>
              <ChartSummaryValue
                isLoading={isTotalsLoading}
                value={
                  defined(totals)
                    ? tooltipFormatterUsingAggregateOutputType(
                        totals.data[0]['p95(transaction.duration)'] as number,
                        'duration'
                      )
                    : undefined
                }
              />
              <Chart
                statsPeriod={(statsPeriod as string) ?? '24h'}
                height={80}
                data={[results[1]]}
                start=""
                end=""
                loading={loading}
                utc={false}
                isLineChart
                definedAxisTicks={2}
                disableXAxis
                chartColors={[P95_COLOR]}
                grid={{
                  left: '8px',
                  right: '0',
                  top: '8px',
                  bottom: '0',
                }}
                tooltipFormatterOptions={{
                  valueFormatter: value =>
                    tooltipFormatterUsingAggregateOutputType(value, 'duration'),
                }}
              />
              <SidebarSpacer />
              <Header>
                <ChartLabel>{DataTitles.errorCount}</ChartLabel>
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
                data={[results[2]]}
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
            </Fragment>
          );
        }}
      </EventsRequest>
    );
  }

  return (
    <PageFiltersContainer>
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{`${method} ${transaction}`}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <SearchContainerWithFilterAndMetrics>
            <PageFilterBar condensed>
              <DatePageFilter alignDropdown="left" />
            </PageFilterBar>
          </SearchContainerWithFilterAndMetrics>

          <Layout.Main>
            <StyledRow minSize={200}>
              <SpanGroupBreakdownContainer transaction={transaction as string} />
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
            {/* TODO: Add transaction method to filter */}
            <SpanMetricsTable filter={state.spansFilter} transaction={transaction} />
            <SubHeader>{t('Sample Events')}</SubHeader>
            <TransactionSamplesTable queryConditions={queryConditions} />
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
            </SegmentedControlContainer>
            <IssuesTable
              issueCategory={issueFilter === 'ALL' ? undefined : issueFilter}
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
}: {
  filter: ModuleName;
  transaction: string | undefined;
}) {
  // TODO: Add transaction http method to query conditions as well, since transaction name alone is not unique
  return (
    <SpansTable
      moduleName={filter ?? ModuleName.ALL}
      transaction={transaction}
      orderBy="-time_spent_percentage"
      onSetOrderBy={() => undefined}
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

const SegmentedControlContainer = styled('div')`
  margin-bottom: ${space(2)};
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
  justify-content: space-between;
`;
