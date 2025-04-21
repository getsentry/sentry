import React, {Fragment} from 'react';

import {Alert} from 'sentry/components/core/alert';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {decodeList, decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useProjects from 'sentry/utils/useProjects';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ReadoutRibbon, ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {getTimeSpentExplanation} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import {useHttpDomainSummaryChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useHttpDomainSummaryChartFilter';
import HttpDomainSummaryDurationChartWidget from 'sentry/views/insights/common/components/widgets/httpDomainSummaryDurationChartWidget';
import HttpDomainSummaryResponseCodesChartWidget from 'sentry/views/insights/common/components/widgets/httpDomainSummaryResponseCodesChartWidget';
import HttpDomainSummaryThroughputChartWidget from 'sentry/views/insights/common/components/widgets/httpDomainSummaryThroughputChartWidget';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useSamplesDrawer} from 'sentry/views/insights/common/utils/useSamplesDrawer';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {
  DataTitles,
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
import {ModuleName, SpanFunction, SpanMetricsField} from 'sentry/views/insights/types';

export function HTTPDomainSummaryPage() {
  const {projects} = useProjects();
  const {view} = useDomainViewFilters();
  const filters = useHttpDomainSummaryChartFilter();

  const {
    domain,
    project: projectId,
    [QueryParameterNames.TRANSACTIONS_CURSOR]: cursor,
    [QueryParameterNames.TRANSACTIONS_SORT]: sortField,
  } = useLocationQuery({
    fields: {
      project: decodeScalar,
      domain: decodeScalar,
      [QueryParameterNames.TRANSACTIONS_CURSOR]: decodeScalar,
      [QueryParameterNames.TRANSACTIONS_SORT]: decodeScalar,
      [SpanMetricsField.USER_GEO_SUBREGION]: decodeList,
      transaction: decodeScalar,
    },
  });
  const sort = decodeSorts(sortField).find(isAValidSort) ?? DEFAULT_SORT;

  useSamplesDrawer({
    Component: <HTTPSamplesPanel />,
    moduleName: ModuleName.HTTP,
    requiredParams: ['transaction'],
  });

  const project = projects.find(p => projectId === p.id);

  const {data: domainMetrics, isPending: areDomainMetricsLoading} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: [
        `${SpanFunction.EPM}()`,
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
        'epm()',
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
                      value={domainMetrics?.[0]?.[`${SpanFunction.EPM}()`]}
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
                <HttpDomainSummaryThroughputChartWidget />
              </ModuleLayout.Third>

              <ModuleLayout.Third>
                <HttpDomainSummaryDurationChartWidget />
              </ModuleLayout.Third>

              <ModuleLayout.Third>
                <HttpDomainSummaryResponseCodesChartWidget />
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
