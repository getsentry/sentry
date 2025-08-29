import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {PageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {OverviewIssuesWidget} from 'sentry/views/insights/common/components/overviewIssuesWidget';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {STARRED_SEGMENT_TABLE_QUERY_KEY} from 'sentry/views/insights/common/components/tableCells/starredSegmentCell';
import OverviewAssetsByTimeSpentWidget from 'sentry/views/insights/common/components/widgets/overviewSlowAssetsWidget';
import OverviewTimeConsumingRequestsWidget from 'sentry/views/insights/common/components/widgets/overviewTimeConsumingRequestsWidget';
import OverviewTransactionDurationChartWidget from 'sentry/views/insights/common/components/widgets/overviewTransactionDurationChartWidget';
import OverviewTransactionThroughputChartWidget from 'sentry/views/insights/common/components/widgets/overviewTransactionThroughputChartWidget';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {TripleRowWidgetWrapper} from 'sentry/views/insights/pages/backend/backendOverviewPage';
import {
  FrontendOverviewTable,
  isAValidSort,
  type ValidSort,
} from 'sentry/views/insights/pages/frontend/frontendOverviewTable';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {Referrer} from 'sentry/views/insights/pages/frontend/referrers';
import type {PageSpanOps} from 'sentry/views/insights/pages/frontend/settings';
import {
  DEFAULT_SORT,
  DEFAULT_SPAN_OP_SELECTION,
  FRONTEND_LANDING_TITLE,
  PAGE_SPAN_OPS,
  SPAN_OP_QUERY_PARAM,
} from 'sentry/views/insights/pages/frontend/settings';
import {useFrontendQuery} from 'sentry/views/insights/pages/frontend/useFrontendQuery';
import {InsightsSpanTagProvider} from 'sentry/views/insights/pages/insightsSpanTagProvider';
import {WebVitalsWidget} from 'sentry/views/insights/pages/platform/nextjs/webVitalsWidget';
import {TransactionNameSearchBar} from 'sentry/views/insights/pages/transactionNameSearchBar';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';
import {categorizeProjects} from 'sentry/views/insights/pages/utils';
import type {SpanProperty} from 'sentry/views/insights/types';
import {LegacyOnboarding} from 'sentry/views/performance/onboarding';

export function NewFrontendOverviewPage() {
  useOverviewPageTrackPageload();
  const organization = useOrganization();
  const location = useLocation();
  const {projects} = useProjects();
  const onboardingProject = useOnboardingProject();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const search = useFrontendQuery({includeWebVitalOps: true});

  const cursor = decodeScalar(location.query?.[QueryParameterNames.PAGES_CURSOR]);
  const spanOp: PageSpanOps = getSpanOpFromQuery(
    decodeScalar(location.query?.[SPAN_OP_QUERY_PARAM])
  );

  const {query: searchBarQuery} = useLocationQuery({
    fields: {
      query: decodeScalar,
    },
  });

  const {
    frontendProjects: selectedFrontendProjects,
    otherProjects: selectedOtherProjects,
  } = categorizeProjects(getSelectedProjectList(selection.projects, projects));

  const showOnboarding = onboardingProject !== undefined;

  const getFreeTextFromQuery = (query: string) => {
    const conditions = new MutableSearch(query);
    const transactionValues = conditions.getFilterValues('transaction');
    if (transactionValues.length) {
      return transactionValues[0];
    }
    if (conditions.freeText.length > 0) {
      // raw text query will be wrapped in wildcards in generatePerformanceEventView
      // so no need to wrap it here
      return conditions.freeText.join(' ');
    }
    return '';
  };

  function handleSearch(searchQuery: string) {
    trackAnalytics('performance.domains.frontend.search', {organization});

    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(searchQuery).trim() || undefined,
        isDefaultQuery: false,
      },
    });
  }

  const sorts: [ValidSort, ValidSort] = [
    {
      field: 'is_starred_transaction' satisfies SpanProperty,
      kind: 'desc',
    },
    decodeSorts(location.query?.sort).find(isAValidSort) ?? DEFAULT_SORT,
  ];

  const displayPerfScore = ['pageload', 'all'].includes(spanOp);

  const response = useSpans(
    {
      search,
      sorts,
      cursor,
      useQueryOptions: {additonalQueryKey: STARRED_SEGMENT_TABLE_QUERY_KEY},
      fields: [
        'is_starred_transaction',
        'transaction',
        'project',
        'tpm()',
        'p50_if(span.duration,is_transaction,equals,true)',
        'p75_if(span.duration,is_transaction,equals,true)',
        'p95_if(span.duration,is_transaction,equals,true)',
        'failure_rate_if(is_transaction,equals,true)',
        ...(displayPerfScore
          ? (['performance_score(measurements.score.total)'] as const)
          : []),
        'count_unique(user)',
        'sum_if(span.duration,is_transaction,equals,true)',
      ],
    },
    Referrer.FRONTEND_LANDING_TABLE
  );

  const searchBarProjectsIds = [
    ...selectedFrontendProjects,
    ...selectedOtherProjects,
  ].map(project => project.id);

  return (
    <Feature
      features="performance-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <FrontendHeader headerTitle={FRONTEND_LANDING_TITLE} />
      <Layout.Body>
        <Layout.Main fullWidth>
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <ToolRibbon>
                <PageFilterBar condensed>
                  <InsightsProjectSelector />
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </PageFilterBar>
                {!showOnboarding && (
                  <InsightsSpanTagProvider>
                    <CompactSelect
                      value={spanOp}
                      menuTitle={t('Filter by operation')}
                      options={[
                        {value: 'all', label: t('All Transactions')},
                        {value: 'pageload', label: t('Pageload')},
                        {value: 'navigation', label: t('Navigation')},
                      ]}
                      onChange={(selectedOption: SelectOption<PageSpanOps>) => {
                        navigate({
                          pathname: location.pathname,
                          query: {
                            ...location.query,
                            [SPAN_OP_QUERY_PARAM]: selectedOption.value,
                          },
                        });
                      }}
                    />
                    <StyledTransactionNameSearchBar
                      organization={organization}
                      projectIds={searchBarProjectsIds}
                      onSearch={(query: string) => {
                        handleSearch(query);
                      }}
                      query={getFreeTextFromQuery(searchBarQuery) ?? ''}
                    />
                  </InsightsSpanTagProvider>
                )}
              </ToolRibbon>
            </ModuleLayout.Full>
            <PageAlert />
            {showOnboarding ? (
              <LegacyOnboarding project={onboardingProject} organization={organization} />
            ) : (
              <Fragment>
                <ModuleLayout.Full>
                  <TripleRowWidgetWrapper>
                    <ModuleLayout.Third>
                      <OverviewTransactionThroughputChartWidget />
                    </ModuleLayout.Third>
                    <ModuleLayout.Third>
                      <OverviewTransactionDurationChartWidget />
                    </ModuleLayout.Third>
                    <ModuleLayout.Third>
                      <OverviewIssuesWidget />
                    </ModuleLayout.Third>
                  </TripleRowWidgetWrapper>
                </ModuleLayout.Full>
                <ModuleLayout.Full>
                  <TripleRowWidgetWrapper>
                    <ModuleLayout.Third>
                      <WebVitalsWidget />
                    </ModuleLayout.Third>
                    <ModuleLayout.Third>
                      <OverviewAssetsByTimeSpentWidget />
                    </ModuleLayout.Third>
                    <ModuleLayout.Third>
                      <OverviewTimeConsumingRequestsWidget />
                    </ModuleLayout.Third>
                  </TripleRowWidgetWrapper>
                </ModuleLayout.Full>
                <ModuleLayout.Full>
                  <FrontendOverviewTable
                    displayPerfScore={displayPerfScore}
                    response={response}
                    sort={sorts[1]}
                  />
                </ModuleLayout.Full>
              </Fragment>
            )}
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </Feature>
  );
}

const isPageSpanOp = (op?: string): op is PageSpanOps => {
  return PAGE_SPAN_OPS.includes(op as PageSpanOps);
};

const getSpanOpFromQuery = (op?: string): PageSpanOps => {
  if (isPageSpanOp(op)) {
    return op;
  }
  return DEFAULT_SPAN_OP_SELECTION;
};

const StyledTransactionNameSearchBar = styled(TransactionNameSearchBar)`
  flex: 2;
`;
