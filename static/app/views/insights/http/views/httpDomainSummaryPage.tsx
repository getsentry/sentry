import React, {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {decodeList, decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {
  EMPTY_OPTION_VALUE,
  escapeFilterValue,
  MutableSearch,
} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ReadoutRibbon, ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {getTimeSpentExplanation} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {
  DataTitles,
  getDurationChartTitle,
  getThroughputChartTitle,
  getThroughputTitle,
} from 'sentry/views/insights/common/views/spans/types';
import {DomainStatusLink} from 'sentry/views/insights/http/components/domainStatusLink';
import {HTTPSamplesPanel} from 'sentry/views/insights/http/components/httpSamplesPanel';
import {
  DomainTransactionsTable,
  isAValidSort,
} from 'sentry/views/insights/http/components/tables/domainTransactionsTable';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {
  BASE_FILTERS,
  FIELD_ALIASES,
  MODULE_DOC_LINK,
  NULL_DOMAIN_DESCRIPTION,
} from 'sentry/views/insights/http/settings';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import type {SpanMetricsQueryFilters} from 'sentry/views/insights/types';
import {ModuleName, SpanFunction, SpanMetricsField} from 'sentry/views/insights/types';

import {InsightsLineChartWidget} from '../../common/components/insightsLineChartWidget';
import {useSamplesDrawer} from '../../common/utils/useSamplesDrawer';

type Query = {
  aggregate?: string;
  domain?: string;
};

export function HTTPDomainSummaryPage() {
  const location = useLocation<Query>();
  const {projects} = useProjects();
  const {view} = useDomainViewFilters();

  // TODO: Fetch sort information using `useLocationQuery`
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const sortField = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_SORT]);

  const sort = decodeSorts(sortField).filter(isAValidSort).at(0) ?? DEFAULT_SORT;

  const {
    domain,
    project: projectId,
    'user.geo.subregion': subregions,
  } = useLocationQuery({
    fields: {
      project: decodeScalar,
      domain: decodeScalar,
      [SpanMetricsField.USER_GEO_SUBREGION]: decodeList,
      transaction: decodeScalar,
    },
  });

  useSamplesDrawer({
    Component: <HTTPSamplesPanel />,
    moduleName: ModuleName.HTTP,
    requiredParams: ['transaction'],
  });

  const project = projects.find(p => projectId === p.id);
  const filters: SpanMetricsQueryFilters = {
    ...BASE_FILTERS,
    'span.domain': domain === '' ? EMPTY_OPTION_VALUE : escapeFilterValue(domain),
    ...(subregions.length > 0
      ? {
          [SpanMetricsField.USER_GEO_SUBREGION]: `[${subregions.join(',')}]`,
        }
      : {}),
  };

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const cursor = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_CURSOR]);

  const {data: domainMetrics, isPending: areDomainMetricsLoading} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: [
        `${SpanFunction.SPM}()`,
        `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
        `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
        'http_response_rate(3)',
        'http_response_rate(4)',
        'http_response_rate(5)',
        `${SpanFunction.TIME_SPENT_PERCENTAGE}()`,
      ],
    },
    Referrer.DOMAIN_SUMMARY_METRICS_RIBBON
  );

  const {
    isPending: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(filters),
      yAxis: ['spm()'],
      transformAliasToInputFormat: true,
    },
    Referrer.DOMAIN_SUMMARY_THROUGHPUT_CHART
  );

  const {
    isPending: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(filters),
      yAxis: [`avg(${SpanMetricsField.SPAN_SELF_TIME})`],
      transformAliasToInputFormat: true,
    },
    Referrer.DOMAIN_SUMMARY_DURATION_CHART
  );

  const {
    isPending: isResponseCodeDataLoading,
    data: responseCodeData,
    error: responseCodeError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(filters),
      yAxis: ['http_response_rate(3)', 'http_response_rate(4)', 'http_response_rate(5)'],
      transformAliasToInputFormat: true,
    },
    Referrer.DOMAIN_SUMMARY_RESPONSE_CODE_CHART
  );

  const {
    isPending: isTransactionsListLoading,
    data: transactionsList,
    meta: transactionsListMeta,
    error: transactionsListError,
    pageLinks: transactionsListPageLinks,
  } = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: [
        'project.id',
        'transaction',
        'transaction.method',
        'spm()',
        'http_response_rate(3)',
        'http_response_rate(4)',
        'http_response_rate(5)',
        'avg(span.self_time)',
        'sum(span.self_time)',
        'time_spent_percentage()',
      ],
      sorts: [sort],
      limit: TRANSACTIONS_TABLE_ROW_COUNT,
      cursor,
    },
    Referrer.DOMAIN_SUMMARY_TRANSACTIONS_LIST
  );

  const headerProps = {
    headerTitle: (
      <Fragment>
        {project && <ProjectAvatar project={project} size={36} />}
        {domain || NULL_DOMAIN_DESCRIPTION}
        <DomainStatusLink domain={domain} />
      </Fragment>
    ),
    breadcrumbs: [
      {
        label: t('Domain Summary'),
      },
    ],
    module: ModuleName.HTTP,
  };

  return (
    <React.Fragment>
      {view === FRONTEND_LANDING_SUB_PATH && <FrontendHeader {...headerProps} />}
      {view === BACKEND_LANDING_SUB_PATH && <BackendHeader {...headerProps} />}
      {view === MOBILE_LANDING_SUB_PATH && <MobileHeader {...headerProps} />}

      <ModuleBodyUpsellHook moduleName={ModuleName.HTTP}>
        <Layout.Body>
          <Layout.Main fullWidth>
            {domain === '' && (
              <Alert.Container>
                <Alert type="info">
                  {tct(
                    '"Unknown Domain" entries can be caused by instrumentation errors. Please refer to our [link] for more information.',
                    {
                      link: (
                        <ExternalLink href={MODULE_DOC_LINK}>documentation</ExternalLink>
                      ),
                    }
                  )}
                </Alert>
              </Alert.Container>
            )}

            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <HeaderContainer>
                  <ToolRibbon>
                    <ModulePageFilterBar
                      moduleName={ModuleName.HTTP}
                      disableProjectFilter
                    />
                    <SubregionSelector />
                  </ToolRibbon>

                  <ReadoutRibbon>
                    <MetricReadout
                      title={getThroughputTitle('http')}
                      value={domainMetrics?.[0]?.[`${SpanFunction.SPM}()`]}
                      unit={RateUnit.PER_MINUTE}
                      isLoading={areDomainMetricsLoading}
                    />

                    <MetricReadout
                      title={DataTitles.avg}
                      value={
                        domainMetrics?.[0]?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]
                      }
                      unit={DurationUnit.MILLISECOND}
                      isLoading={areDomainMetricsLoading}
                    />

                    <MetricReadout
                      title={t('3XXs')}
                      value={domainMetrics?.[0]?.[`http_response_rate(3)`]}
                      unit="percentage"
                      isLoading={areDomainMetricsLoading}
                    />

                    <MetricReadout
                      title={t('4XXs')}
                      value={domainMetrics?.[0]?.[`http_response_rate(4)`]}
                      unit="percentage"
                      isLoading={areDomainMetricsLoading}
                    />

                    <MetricReadout
                      title={t('5XXs')}
                      value={domainMetrics?.[0]?.[`http_response_rate(5)`]}
                      unit="percentage"
                      isLoading={areDomainMetricsLoading}
                    />

                    <MetricReadout
                      title={DataTitles.timeSpent}
                      value={domainMetrics?.[0]?.['sum(span.self_time)']}
                      unit={DurationUnit.MILLISECOND}
                      tooltip={getTimeSpentExplanation(
                        domainMetrics?.[0]?.['time_spent_percentage()']!,
                        'http'
                      )}
                      isLoading={areDomainMetricsLoading}
                    />
                  </ReadoutRibbon>
                </HeaderContainer>
              </ModuleLayout.Full>

              <ModuleLayout.Third>
                <InsightsLineChartWidget
                  title={getThroughputChartTitle('http')}
                  series={[throughputData['spm()']]}
                  isLoading={isThroughputDataLoading}
                  error={throughputError}
                />
              </ModuleLayout.Third>

              <ModuleLayout.Third>
                <InsightsLineChartWidget
                  title={getDurationChartTitle('http')}
                  series={[durationData[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]]}
                  isLoading={isDurationDataLoading}
                  error={durationError}
                />
              </ModuleLayout.Third>

              <ModuleLayout.Third>
                <InsightsLineChartWidget
                  title={DataTitles.unsuccessfulHTTPCodes}
                  series={[
                    responseCodeData[`http_response_rate(3)`],
                    responseCodeData[`http_response_rate(4)`],
                    responseCodeData[`http_response_rate(5)`],
                  ]}
                  aliases={FIELD_ALIASES}
                  isLoading={isResponseCodeDataLoading}
                  error={responseCodeError}
                />
              </ModuleLayout.Third>

              <ModuleLayout.Full>
                <DomainTransactionsTable
                  domain={domain}
                  data={transactionsList}
                  error={transactionsListError}
                  isLoading={isTransactionsListLoading}
                  meta={transactionsListMeta}
                  pageLinks={transactionsListPageLinks}
                  sort={sort}
                />
              </ModuleLayout.Full>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </ModuleBodyUpsellHook>
    </React.Fragment>
  );
}

const DEFAULT_SORT = {
  field: 'time_spent_percentage()' as const,
  kind: 'desc' as const,
};

const TRANSACTIONS_TABLE_ROW_COUNT = 20;

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="http" pageTitle={t('Domain Summary')}>
      <HTTPDomainSummaryPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
