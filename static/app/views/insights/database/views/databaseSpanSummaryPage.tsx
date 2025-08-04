import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import InsightIssuesList from 'sentry/views/insights/common/components/issues';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ReadoutRibbon, ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {DatabaseSpanDescription} from 'sentry/views/insights/common/components/spanDescription';
import DatabaseSummaryDurationChartWidget from 'sentry/views/insights/common/components/widgets/databaseSummaryDurationChartWidget';
import DatabaseSummaryThroughputChartWidget from 'sentry/views/insights/common/components/widgets/databaseSummaryThroughputChartWidget';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useModuleTitle} from 'sentry/views/insights/common/utils/useModuleTitle';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {useSamplesDrawer} from 'sentry/views/insights/common/utils/useSamplesDrawer';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {
  DataTitles,
  getThroughputTitle,
} from 'sentry/views/insights/common/views/spans/types';
import {SampleList} from 'sentry/views/insights/common/views/spanSummaryPage/sampleList';
import {isAValidSort} from 'sentry/views/insights/database/components/tables/queriesTable';
import {QueryTransactionsTable} from 'sentry/views/insights/database/components/tables/queryTransactionsTable';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import type {SpanQueryFilters} from 'sentry/views/insights/types';
import {ModuleName, SpanFields, SpanFunction} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';

type Query = {
  transaction: string;
  transactionMethod: string;
  [QueryParameterNames.TRANSACTIONS_SORT]: string;
  aggregate?: string;
};

type Props = RouteComponentProps<{groupId: string}, Record<string, unknown>, any, Query>;

export function DatabaseSpanSummaryPage({params}: Props) {
  const moduleTitle = useModuleTitle(ModuleName.DB);
  const moduleURL = useModuleURL(ModuleName.DB);
  const location = useLocation<Query>();

  const {groupId} = params;

  const filters: SpanQueryFilters = {
    'span.group': groupId,
  };

  // @ts-expect-error TS(2551): Property 'transactionsCursor' does not exist on ty... Remove this comment to see the full error message
  const cursor = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_CURSOR]);

  // TODO: Fetch sort information using `useLocationQuery`
  const sortField = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_SORT]);

  const sort = decodeSorts(sortField).find(isAValidSort) ?? DEFAULT_SORT;

  const {data: indexedSpansByGroupId, isPending: areIndexedSpansByGroupIdLoading} =
    useSpans(
      {
        search: MutableSearch.fromQueryObject({'span.group': params.groupId}),
        limit: 1,
        sorts: [{field: SpanFields.CODE_FILEPATH, kind: 'desc'}],
        fields: [
          SpanFields.PROJECT_ID,
          SpanFields.SPAN_DESCRIPTION,
          SpanFields.DB_SYSTEM,
          SpanFields.CODE_FILEPATH,
          SpanFields.CODE_LINENO,
          SpanFields.CODE_FUNCTION,
          SpanFields.SDK_NAME,
          SpanFields.SDK_VERSION,
          SpanFields.RELEASE,
          SpanFields.PLATFORM,
        ],
      },
      'api.starfish.span-description'
    );

  const {data, isPending: areSpanMetricsLoading} = useSpans(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: [
        SpanFields.NORMALIZED_DESCRIPTION,
        `${SpanFunction.EPM}()`,
        `sum(${SpanFields.SPAN_SELF_TIME})`,
        `avg(${SpanFields.SPAN_SELF_TIME})`,
      ],
      enabled: Boolean(groupId),
    },
    'api.starfish.span-summary-page-metrics'
  );

  const spanMetrics = data[0];

  const {
    isPending: isTransactionsListLoading,
    data: transactionsList,
    meta: transactionsListMeta,
    error: transactionsListError,
    pageLinks: transactionsListPageLinks,
  } = useSpans(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: [
        'transaction',
        'transaction.method',
        'epm()',
        `sum(${SpanFields.SPAN_SELF_TIME})`,
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `${SpanFunction.HTTP_RESPONSE_COUNT}(5)`,
      ],
      sorts: [sort],
      limit: TRANSACTIONS_TABLE_ROW_COUNT,
      cursor,
    },
    'api.starfish.span-transaction-metrics'
  );

  useSamplesDrawer({
    Component: (
      <SampleList
        groupId={groupId}
        moduleName={ModuleName.DB}
        referrer={TraceViewSources.QUERIES_MODULE}
      />
    ),
    moduleName: ModuleName.DB,
    requiredParams: ['transaction'],
  });

  return (
    <Fragment>
      <BackendHeader
        headerTitle={t('Query Summary')}
        breadcrumbs={[
          {
            label: moduleTitle,
            to: moduleURL,
          },
          {
            label: t('Query Summary'),
          },
        ]}
        module={ModuleName.DB}
        hideDefaultTabs
      />

      <ModuleBodyUpsellHook moduleName={ModuleName.DB}>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <HeaderContainer>
                  <ToolRibbon>
                    <ModulePageFilterBar
                      moduleName={ModuleName.DB}
                      disableProjectFilter
                    />
                  </ToolRibbon>

                  <ReadoutRibbon>
                    <MetricReadout
                      title={getThroughputTitle('db')}
                      value={spanMetrics?.[`${SpanFunction.EPM}()`]}
                      unit={RateUnit.PER_MINUTE}
                      isLoading={areSpanMetricsLoading}
                    />

                    <MetricReadout
                      title={DataTitles.avg}
                      value={spanMetrics?.[`avg(${SpanFields.SPAN_SELF_TIME})`]}
                      unit={DurationUnit.MILLISECOND}
                      isLoading={areSpanMetricsLoading}
                    />

                    <MetricReadout
                      title={DataTitles.timeSpent}
                      value={spanMetrics?.['sum(span.self_time)']}
                      unit={DurationUnit.MILLISECOND}
                      isLoading={areSpanMetricsLoading}
                    />
                  </ReadoutRibbon>
                </HeaderContainer>
              </ModuleLayout.Full>

              {groupId && (
                <DescriptionContainer>
                  <DatabaseSpanDescription
                    groupId={groupId}
                    preliminaryDescription={
                      spanMetrics?.[SpanFields.NORMALIZED_DESCRIPTION]
                    }
                  />
                </DescriptionContainer>
              )}

              {!areIndexedSpansByGroupIdLoading && (
                <ModuleLayout.Full>
                  <InsightIssuesList
                    issueTypes={[
                      'performance_slow_db_query',
                      'performance_n_plus_one_db_queries',
                    ]}
                    message={indexedSpansByGroupId[0]?.['span.description']}
                  />
                </ModuleLayout.Full>
              )}

              <ModuleLayout.Full>
                <ChartContainer>
                  <DatabaseSummaryThroughputChartWidget />

                  <DatabaseSummaryDurationChartWidget />
                </ChartContainer>
              </ModuleLayout.Full>

              {groupId && (
                <ModuleLayout.Full>
                  <QueryTransactionsTable
                    groupId={groupId}
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
          </Layout.Main>
        </Layout.Body>
      </ModuleBodyUpsellHook>
    </Fragment>
  );
}

const DEFAULT_SORT = {
  kind: 'desc' as const,
  field: 'sum(span.self_time)' as const,
};

const TRANSACTIONS_TABLE_ROW_COUNT = 25;

const ChartContainer = styled('div')`
  display: grid;
  gap: 0;
  grid-template-columns: 1fr;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr 1fr;
    gap: ${space(2)};
  }
`;

const DescriptionContainer = styled(ModuleLayout.Full)`
  line-height: 1.2;
`;

function PageWithProviders(props: Props) {
  return (
    <ModulePageProviders moduleName="db" pageTitle={t('Query Summary')}>
      <DatabaseSpanSummaryPage {...props} />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
