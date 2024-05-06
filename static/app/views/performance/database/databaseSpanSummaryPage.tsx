import {Fragment} from 'react';
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {DurationChart} from 'sentry/views/performance/database/durationChart';
import {isAValidSort} from 'sentry/views/performance/database/queriesTable';
import {QueryTransactionsTable} from 'sentry/views/performance/database/queryTransactionsTable';
import {ThroughputChart} from 'sentry/views/performance/database/throughputChart';
import {useSelectedDurationAggregate} from 'sentry/views/performance/database/useSelectedDurationAggregate';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import {DatabaseSpanDescription} from 'sentry/views/starfish/components/spanDescription';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSeries';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import type {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';
import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import {SampleList} from 'sentry/views/starfish/views/spanSummaryPage/sampleList';

type Query = {
  transaction: string;
  transactionMethod: string;
  [QueryParameterNames.TRANSACTIONS_SORT]: string;
  aggregate?: string;
};

type Props = RouteComponentProps<Query, {groupId: string}>;

export function DatabaseSpanSummaryPage({params}: Props) {
  const organization = useOrganization();
  const location = useLocation<Query>();

  const [selectedAggregate] = useSelectedDurationAggregate();

  const {groupId} = params;
  const {transaction, transactionMethod} = location.query;

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
  };

  const cursor = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_CURSOR]);

  // TODO: Fetch sort information using `useLocationQuery`
  const sortField = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_SORT]);

  const sort = decodeSorts(sortField).filter(isAValidSort).at(0) ?? DEFAULT_SORT;

  const {data, isLoading: areSpanMetricsLoading} = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
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
    enabled: Boolean(groupId),
    referrer: 'api.starfish.span-summary-page-metrics',
  });

  const spanMetrics = data[0] ?? {};

  const {
    isLoading: isTransactionsListLoading,
    data: transactionsList,
    meta: transactionsListMeta,
    error: transactionsListError,
    pageLinks: transactionsListPageLinks,
  } = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
    fields: [
      'transaction',
      'transaction.method',
      'spm()',
      `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
      `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
      'time_spent_percentage()',
      `${SpanFunction.HTTP_ERROR_COUNT}()`,
    ],
    sorts: [sort],
    limit: TRANSACTIONS_TABLE_ROW_COUNT,
    cursor,
    referrer: 'api.starfish.span-transaction-metrics',
  });

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
    search: MutableSearch.fromQueryObject(filters),
    yAxis: ['spm()'],
    enabled: Boolean(groupId),
    referrer: 'api.starfish.span-summary-page-metrics-chart',
  });

  const {
    isLoading: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(filters),
    yAxis: [`${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`],
    enabled: Boolean(groupId),
    referrer: 'api.starfish.span-summary-page-metrics-chart',
  });

  useSynchronizeCharts([!isThroughputDataLoading && !isDurationDataLoading]);

  return (
    <Fragment>
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
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <FeedbackWidgetButton />
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
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
                  series={[
                    durationData[
                      `${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`
                    ],
                  ]}
                  isLoading={isDurationDataLoading}
                  error={durationError}
                />
              </ChartContainer>
            </ModuleLayout.Full>

            {span && (
              <ModuleLayout.Full>
                <QueryTransactionsTable
                  span={span}
                  data={transactionsList}
                  error={transactionsListError}
                  isLoading={isTransactionsListLoading}
                  meta={transactionsListMeta}
                  pageLinks={transactionsListPageLinks}
                  sort={sort}
                />
              </ModuleLayout.Full>
            )}
          </ModuleLayout.Layout>

          <SampleList
            groupId={span[SpanMetricsField.SPAN_GROUP]}
            transactionName={transaction}
            transactionMethod={transactionMethod}
          />
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

const DEFAULT_SORT = {
  kind: 'desc' as const,
  field: 'time_spent_percentage()' as const,
};

const TRANSACTIONS_TABLE_ROW_COUNT = 25;

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

function PageWithProviders(props) {
  return (
    <ModulePageProviders
      title={[t('Performance'), t('Database'), t('Query Summary')].join(' — ')}
      baseURL="/performance/database"
      features="spans-first-ui"
    >
      <DatabaseSpanSummaryPage {...props} />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
