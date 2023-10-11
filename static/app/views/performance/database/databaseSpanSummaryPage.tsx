import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import DatePageFilter from 'sentry/components/datePageFilter';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Sort} from 'sentry/utils/discover/fields';
import {RateUnits} from 'sentry/utils/discover/fields';
import {formatRate} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';
import {RELEASE_LEVEL} from 'sentry/views/performance/database/settings';
import {AVG_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {SpanDescription} from 'sentry/views/starfish/components/spanDescription';
import {useFullSpanFromTrace} from 'sentry/views/starfish/queries/useFullSpanFromTrace';
import {
  SpanSummaryQueryFilters,
  useSpanMetrics,
} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {
  getDurationChartTitle,
  getThroughputChartTitle,
} from 'sentry/views/starfish/views/spans/types';
import {useModuleSort} from 'sentry/views/starfish/views/spans/useModuleSort';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';
import {SampleList} from 'sentry/views/starfish/views/spanSummaryPage/sampleList';
import {SpanMetricsRibbon} from 'sentry/views/starfish/views/spanSummaryPage/spanMetricsRibbon';
import {SpanTransactionsTable} from 'sentry/views/starfish/views/spanSummaryPage/spanTransactionsTable';

type Query = {
  endpoint: string;
  endpointMethod: string;
  transaction: string;
  transactionMethod: string;
  [QueryParameterNames.SPANS_SORT]: string;
};

type Props = {
  location: Location<Query>;
} & RouteComponentProps<Query, {groupId: string}>;

function SpanSummaryPage({params}: Props) {
  const organization = useOrganization();
  const location = useLocation<Query>();

  const {groupId} = params;
  const {transaction, transactionMethod, endpoint, endpointMethod} = location.query;

  const queryFilter: SpanSummaryQueryFilters = endpoint
    ? {transactionName: endpoint, 'transaction.method': endpointMethod}
    : {};

  const sort = useModuleSort(QueryParameterNames.ENDPOINTS_SORT, DEFAULT_SORT);

  const {data: fullSpan} = useFullSpanFromTrace(groupId);

  const {data: spanMetrics} = useSpanMetrics(
    groupId,
    queryFilter,
    [
      SpanMetricsField.SPAN_OP,
      SpanMetricsField.SPAN_DESCRIPTION,
      SpanMetricsField.SPAN_ACTION,
      SpanMetricsField.SPAN_DOMAIN,
      'count()',
      `${SpanFunction.SPM}()`,
      `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
      `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
      `${SpanFunction.TIME_SPENT_PERCENTAGE}()`,
      `${SpanFunction.HTTP_ERROR_COUNT}()`,
    ],
    'api.starfish.span-summary-page-metrics'
  );

  const span = {
    ...spanMetrics,
    [SpanMetricsField.SPAN_GROUP]: groupId,
  } as {
    [SpanMetricsField.SPAN_OP]: string;
    [SpanMetricsField.SPAN_DESCRIPTION]: string;
    [SpanMetricsField.SPAN_ACTION]: string;
    [SpanMetricsField.SPAN_DOMAIN]: string[];
    [SpanMetricsField.SPAN_GROUP]: string;
  };

  const {isLoading: areSpanMetricsSeriesLoading, data: spanMetricsSeriesData} =
    useSpanMetricsSeries(
      groupId,
      queryFilter,
      [`avg(${SpanMetricsField.SPAN_SELF_TIME})`, 'spm()', 'http_error_count()'],
      'api.starfish.span-summary-page-metrics-chart'
    );

  useSynchronizeCharts([!areSpanMetricsSeriesLoading]);

  const spanMetricsThroughputSeries = {
    seriesName: span?.[SpanMetricsField.SPAN_OP]?.startsWith('db')
      ? 'Queries'
      : 'Requests',
    data: spanMetricsSeriesData?.['spm()'].data,
  };

  return (
    <ModulePageProviders
      title={[t('Performance'), t('Database'), t('Query Summary')].join(' — ')}
    >
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: 'Performance',
                to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                preservePageFilters: true,
              },
              {
                label: 'Queries',
                to: normalizeUrl(
                  `/organizations/${organization.slug}/performance/database`
                ),
                preservePageFilters: true,
              },
              {
                label: 'Query Summary',
              },
            ]}
          />
          <Layout.Title>
            {t('Query Summary')}
            <FeatureBadge type={RELEASE_LEVEL} />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <HeaderContainer>
            <PaddedContainer>
              <PageFilterBar condensed>
                <EnvironmentPageFilter />
                <DatePageFilter alignDropdown="left" />
              </PageFilterBar>
            </PaddedContainer>

            <SpanMetricsRibbon spanMetrics={span} />
          </HeaderContainer>

          {span?.[SpanMetricsField.SPAN_DESCRIPTION] && (
            <DescriptionContainer>
              <SpanDescription
                span={{
                  ...span,
                  [SpanMetricsField.SPAN_DESCRIPTION]:
                    fullSpan?.description ??
                    spanMetrics?.[SpanMetricsField.SPAN_DESCRIPTION],
                }}
              />
            </DescriptionContainer>
          )}

          <BlockContainer>
            <Block>
              <ChartPanel
                title={getThroughputChartTitle(span?.[SpanMetricsField.SPAN_OP])}
              >
                <Chart
                  height={CHART_HEIGHT}
                  data={[spanMetricsThroughputSeries]}
                  loading={areSpanMetricsSeriesLoading}
                  utc={false}
                  chartColors={[THROUGHPUT_COLOR]}
                  isLineChart
                  definedAxisTicks={4}
                  aggregateOutputFormat="rate"
                  rateUnit={RateUnits.PER_MINUTE}
                  tooltipFormatterOptions={{
                    valueFormatter: value => formatRate(value, RateUnits.PER_MINUTE),
                  }}
                />
              </ChartPanel>
            </Block>

            <Block>
              <ChartPanel title={getDurationChartTitle(span?.[SpanMetricsField.SPAN_OP])}>
                <Chart
                  height={CHART_HEIGHT}
                  data={[
                    spanMetricsSeriesData?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`],
                  ]}
                  loading={areSpanMetricsSeriesLoading}
                  utc={false}
                  chartColors={[AVG_COLOR]}
                  isLineChart
                  definedAxisTicks={4}
                />
              </ChartPanel>
            </Block>
          </BlockContainer>

          {span && (
            <SpanTransactionsTable
              span={span}
              sort={sort}
              endpoint={endpoint}
              endpointMethod={endpointMethod}
            />
          )}

          <SampleList
            groupId={span[SpanMetricsField.SPAN_GROUP]}
            transactionName={transaction}
            transactionMethod={transactionMethod}
          />
        </Layout.Main>
      </Layout.Body>
    </ModulePageProviders>
  );
}

const CHART_HEIGHT = 160;

const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'time_spent_percentage()',
};

const PaddedContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const HeaderContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
`;

const DescriptionContainer = styled('div')`
  width: 100%;
  margin-bottom: ${space(2)};
  font-size: 1rem;
  line-height: 1.2;
`;

export default SpanSummaryPage;
