import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import FeedbackWidget from 'sentry/components/feedback/widget/feedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {DurationChart} from 'sentry/views/performance/database/durationChart';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';
import {ThroughputChart} from 'sentry/views/performance/database/throughputChart';
import {useAvailableDurationAggregates} from 'sentry/views/performance/database/useAvailableDurationAggregates';
import {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import {SpanDescription} from 'sentry/views/starfish/components/spanDescription';
import {useFullSpanFromTrace} from 'sentry/views/starfish/queries/useFullSpanFromTrace';
import {
  SpanSummaryQueryFilters,
  useSpanMetrics,
} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {
  SpanFunction,
  SpanMetricsField,
  SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
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
  aggregate?: string;
};

type Props = {
  location: Location<Query>;
} & RouteComponentProps<Query, {groupId: string}>;

function SpanSummaryPage({params}: Props) {
  const organization = useOrganization();
  const location = useLocation<Query>();

  const {selectedAggregate} = useAvailableDurationAggregates();

  const {groupId} = params;
  const {transaction, transactionMethod, endpoint, endpointMethod} = location.query;

  const queryFilter: SpanSummaryQueryFilters = endpoint
    ? {transactionName: endpoint, 'transaction.method': endpointMethod}
    : {};

  const seriesQueryFilters: SpanMetricsQueryFilters = endpoint
    ? {
        transaction: endpoint,
        'transaction.method': endpointMethod,
      }
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

  const {isLoading: isThroughputDataLoading, data: throughputData} = useSpanMetricsSeries(
    {...seriesQueryFilters, 'span.group': groupId},
    ['spm()'],
    'api.starfish.span-summary-page-metrics-chart'
  );

  const {isLoading: isDurationDataLoading, data: durationData} = useSpanMetricsSeries(
    {...seriesQueryFilters, 'span.group': groupId},
    [`${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`],
    'api.starfish.span-summary-page-metrics-chart'
  );

  useSynchronizeCharts([!isThroughputDataLoading && !isDurationDataLoading]);

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
          <Layout.Title>{t('Query Summary')}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <FeedbackWidget />
        <Layout.Main fullWidth>
          <HeaderContainer>
            <PaddedContainer>
              <PageFilterBar condensed>
                <EnvironmentPageFilter />
                <DatePageFilter />
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
              <ThroughputChart
                series={throughputData['spm()']}
                isLoading={isThroughputDataLoading}
              />
            </Block>

            <Block>
              <DurationChart
                series={
                  durationData[`${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`]
                }
                isLoading={isDurationDataLoading}
              />
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
