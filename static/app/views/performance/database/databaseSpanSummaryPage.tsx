import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit, RateUnit, type Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {DurationChart} from 'sentry/views/performance/database/durationChart';
import {ThroughputChart} from 'sentry/views/performance/database/throughputChart';
import {useSelectedDurationAggregate} from 'sentry/views/performance/database/useSelectedDurationAggregate';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import {DatabaseSpanDescription} from 'sentry/views/starfish/components/spanDescription';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import type {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';
import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import {useModuleSort} from 'sentry/views/starfish/views/spans/useModuleSort';
import {SampleList} from 'sentry/views/starfish/views/spanSummaryPage/sampleList';
import {SpanTransactionsTable} from 'sentry/views/starfish/views/spanSummaryPage/spanTransactionsTable';

type Query = {
  endpoint: string;
  endpointMethod: string;
  transaction: string;
  transactionMethod: string;
  [QueryParameterNames.SPANS_SORT]: string;
  aggregate?: string;
};

type Props = {
  location: Location<Query>;
} & RouteComponentProps<Query, {groupId: string}>;

function SpanSummaryPage({params}: Props) {
  const organization = useOrganization();
  const location = useLocation<Query>();

  const [selectedAggregate] = useSelectedDurationAggregate();

  const {groupId} = params;
  const {transaction, transactionMethod, endpoint, endpointMethod} = location.query;

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
  };

  if (endpoint) {
    filters.transaction = endpoint;
    filters['transaction.method'] = endpointMethod;
  }

  const sort = useModuleSort(QueryParameterNames.ENDPOINTS_SORT, DEFAULT_SORT);

  const {data, isLoading: areSpanMetricsLoading} = useSpanMetrics({
    filters,
    fields: [
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
    referrer: 'api.starfish.span-summary-page-metrics',
  });

  const spanMetrics = data[0] ?? {};

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

  const {
    isLoading: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries({
    filters,
    yAxis: ['spm()'],
    referrer: 'api.starfish.span-summary-page-metrics-chart',
  });

  const {
    isLoading: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries({
    filters,
    yAxis: [`${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`],
    referrer: 'api.starfish.span-summary-page-metrics-chart',
  });

  useSynchronizeCharts([!isThroughputDataLoading && !isDurationDataLoading]);

  return (
    <ModulePageProviders
      title={[t('Performance'), t('Database'), t('Query Summary')].join(' — ')}
      baseURL="/performance/database"
      features="performance-database-view"
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
          <Layout.Title>{t('Query Summary')}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <FloatingFeedbackWidget />

          <HeaderContainer>
            <PageFilterBar condensed>
              <EnvironmentPageFilter />
              <DatePageFilter />
            </PageFilterBar>

            <MetricsRibbon>
              <MetricReadout
                title={getThroughputTitle('db')}
                value={spanMetrics?.[`${SpanFunction.SPM}()`]}
                unit={RateUnit.PER_MINUTE}
                isLoading={areSpanMetricsLoading}
              />

              <MetricReadout
                title={DataTitles.avg}
                value={spanMetrics?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]}
                unit={DurationUnit.MILLISECOND}
                isLoading={areSpanMetricsLoading}
              />

              <MetricReadout
                title={DataTitles.timeSpent}
                value={spanMetrics?.['sum(span.self_time)']}
                unit={DurationUnit.MILLISECOND}
                tooltip={getTimeSpentExplanation(
                  spanMetrics?.['time_spent_percentage()'],
                  'db'
                )}
                isLoading={areSpanMetricsLoading}
              />
            </MetricsRibbon>
          </HeaderContainer>

          <ModuleLayout.Layout>
            {groupId && (
              <DescriptionContainer>
                <DatabaseSpanDescription
                  groupId={groupId}
                  preliminaryDescription={spanMetrics?.['span.description']}
                />
              </DescriptionContainer>
            )}

            <ModuleLayout.Full>
              <ChartContainer>
                <ThroughputChart
                  series={throughputData['spm()']}
                  isLoading={isThroughputDataLoading}
                  error={throughputError}
                />

                <DurationChart
                  series={
                    durationData[
                      `${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`
                    ]
                  }
                  isLoading={isDurationDataLoading}
                  error={durationError}
                />
              </ChartContainer>
            </ModuleLayout.Full>

            {span && (
              <ModuleLayout.Full>
                <SpanTransactionsTable
                  span={span}
                  sort={sort}
                  endpoint={endpoint}
                  endpointMethod={endpointMethod}
                />
              </ModuleLayout.Full>
            )}

            <SampleList
              groupId={span[SpanMetricsField.SPAN_GROUP]}
              transactionName={transaction}
              transactionMethod={transactionMethod}
            />
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </ModulePageProviders>
  );
}

const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'time_spent_percentage()',
};

const ChartContainer = styled('div')`
  display: grid;
  gap: 0;
  grid-template-columns: 1fr;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr 1fr;
    gap: ${space(2)};
  }
`;

const HeaderContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
`;

const DescriptionContainer = styled(ModuleLayout.Full)`
  line-height: 1.2;
`;

const MetricsRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;

export default SpanSummaryPage;
