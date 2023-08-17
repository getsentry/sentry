import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import DatePageFilter from 'sentry/components/datePageFilter';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
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
import {SpanMetricsFields, StarfishFunctions} from 'sentry/views/starfish/types';
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
  [QueryParameterNames.SORT]: string;
};

type Props = {
  location: Location<Query>;
} & RouteComponentProps<Query, {groupId: string}>;

function SpanSummaryPage({params}: Props) {
  const organization = useOrganization();
  const location = useLocation<Query>();

  const {groupId} = params;
  const {endpoint, endpointMethod} = location.query;

  const queryFilter: SpanSummaryQueryFilters = endpoint
    ? {transactionName: endpoint, 'transaction.method': endpointMethod}
    : {};

  const sort = useModuleSort(DEFAULT_SORT);

  const {data: fullSpan} = useFullSpanFromTrace(groupId);

  const {data: spanMetrics} = useSpanMetrics(
    groupId,
    queryFilter,
    [
      SpanMetricsFields.SPAN_OP,
      SpanMetricsFields.SPAN_DESCRIPTION,
      SpanMetricsFields.SPAN_ACTION,
      SpanMetricsFields.SPAN_DOMAIN,
      'count()',
      `${StarfishFunctions.SPM}()`,
      `sum(${SpanMetricsFields.SPAN_SELF_TIME})`,
      `avg(${SpanMetricsFields.SPAN_SELF_TIME})`,
      `${StarfishFunctions.TIME_SPENT_PERCENTAGE}()`,
      `${StarfishFunctions.HTTP_ERROR_COUNT}()`,
    ],
    'api.starfish.span-summary-page-metrics'
  );

  const span = {
    ...spanMetrics,
    [SpanMetricsFields.SPAN_GROUP]: groupId,
  } as {
    [SpanMetricsFields.SPAN_OP]: string;
    [SpanMetricsFields.SPAN_DESCRIPTION]: string;
    [SpanMetricsFields.SPAN_ACTION]: string;
    [SpanMetricsFields.SPAN_DOMAIN]: string;
    [SpanMetricsFields.SPAN_GROUP]: string;
  };

  const {isLoading: areSpanMetricsSeriesLoading, data: spanMetricsSeriesData} =
    useSpanMetricsSeries(
      groupId,
      queryFilter,
      [`avg(${SpanMetricsFields.SPAN_SELF_TIME})`, 'spm()', 'http_error_count()'],
      'api.starfish.span-summary-page-metrics-chart'
    );

  useSynchronizeCharts([!areSpanMetricsSeriesLoading]);

  const spanMetricsThroughputSeries = {
    seriesName: span?.[SpanMetricsFields.SPAN_OP]?.startsWith('db')
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
                label: 'Database',
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
            <FeatureBadge type="alpha" />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <HeaderContainer>
            <PaddedContainer>
              <PageFilterBar condensed>
                <DatePageFilter alignDropdown="left" />
              </PageFilterBar>
            </PaddedContainer>

            <SpanMetricsRibbon spanMetrics={span} />
          </HeaderContainer>

          {span?.[SpanMetricsFields.SPAN_DESCRIPTION] && (
            <DescriptionContainer>
              <SpanDescription
                span={{
                  ...span,
                  [SpanMetricsFields.SPAN_DESCRIPTION]:
                    fullSpan?.description ??
                    spanMetrics?.[SpanMetricsFields.SPAN_DESCRIPTION],
                }}
              />
            </DescriptionContainer>
          )}

          <BlockContainer>
            <Block>
              <ChartPanel
                title={getThroughputChartTitle(span?.[SpanMetricsFields.SPAN_OP])}
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
              <ChartPanel
                title={getDurationChartTitle(span?.[SpanMetricsFields.SPAN_OP])}
              >
                <Chart
                  height={CHART_HEIGHT}
                  data={[
                    spanMetricsSeriesData?.[`avg(${SpanMetricsFields.SPAN_SELF_TIME})`],
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
            projectId={span[SpanMetricsFields.PROJECT_ID]}
            groupId={span[SpanMetricsFields.SPAN_GROUP]}
            transactionName={endpoint}
            transactionMethod={endpointMethod}
          />
        </Layout.Main>
      </Layout.Body>
    </ModulePageProviders>
  );
}

const CHART_HEIGHT = 160;

const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'time_spent_percentage(local)',
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
