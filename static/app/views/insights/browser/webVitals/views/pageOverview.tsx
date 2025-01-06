import React, {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {LinkButton} from 'sentry/components/button';
import {AggregateSpans} from 'sentry/components/events/interfaces/spans/aggregateSpans';
import * as Layout from 'sentry/components/layouts/thirds';
import {TabList, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import BrowserTypeSelector from 'sentry/views/insights/browser/webVitals/components/browserTypeSelector';
import {PerformanceScoreBreakdownChart} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreBreakdownChart';
import {PageOverviewSidebar} from 'sentry/views/insights/browser/webVitals/components/pageOverviewSidebar';
import {PageOverviewWebVitalsDetailPanel} from 'sentry/views/insights/browser/webVitals/components/pageOverviewWebVitalsDetailPanel';
import {PageSamplePerformanceTable} from 'sentry/views/insights/browser/webVitals/components/tables/pageSamplePerformanceTable';
import WebVitalMeters from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import {useProjectRawWebVitalsQuery} from 'sentry/views/insights/browser/webVitals/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {getWebVitalScoresFromTableDataRow} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/getWebVitalScoresFromTableDataRow';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import decodeBrowserTypes from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {
  ModuleName,
  SpanIndexedField,
  type SubregionCode,
} from 'sentry/views/insights/types';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

export enum LandingDisplayField {
  OVERVIEW = 'overview',
  SPANS = 'spans',
}

const LANDING_DISPLAYS = [
  {
    label: t('Overview'),
    field: LandingDisplayField.OVERVIEW,
  },
  {
    label: t('Aggregate Spans'),
    field: LandingDisplayField.SPANS,
  },
];

function getCurrentTabSelection(selectedTab) {
  const tab = decodeScalar(selectedTab);
  if (tab && Object.values(LandingDisplayField).includes(tab as LandingDisplayField)) {
    return tab as LandingDisplayField;
  }
  return LandingDisplayField.OVERVIEW;
}

export function PageOverview() {
  const navigate = useNavigate();
  const moduleURL = useModuleURL('vital');
  const organization = useOrganization();
  const location = useLocation();
  const {projects} = useProjects();
  const router = useRouter();
  const {view} = useDomainViewFilters();
  const transaction = location.query.transaction
    ? Array.isArray(location.query.transaction)
      ? location.query.transaction[0]
      : location.query.transaction
    : undefined;
  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const tab = getCurrentTabSelection(location.query.tab);

  // TODO: When visiting page overview from a specific webvital detail panel in the landing page,
  // we should automatically default this webvital state to the respective webvital so the detail
  // panel in this page opens automatically.
  const [state, setState] = useState<{webVital: WebVitals | null}>({
    webVital: (location.query.webVital as WebVitals) ?? null,
  });

  const query = decodeScalar(location.query.query);
  const browserTypes = decodeBrowserTypes(location.query[SpanIndexedField.BROWSER_NAME]);
  const subregions = decodeList(
    location.query[SpanIndexedField.USER_GEO_SUBREGION]
  ) as SubregionCode[];

  const {data: pageData, isPending} = useProjectRawWebVitalsQuery({
    transaction,
    browserTypes,
    subregions,
  });
  const {data: projectScores, isPending: isProjectScoresLoading} =
    useProjectWebVitalsScoresQuery({transaction, browserTypes, subregions});

  if (transaction === undefined) {
    // redirect user to webvitals landing page
    window.location.href = moduleURL;
    return null;
  }

  const transactionSummaryTarget =
    project &&
    !Array.isArray(location.query.project) && // Only render button to transaction summary when one project is selected.
    transaction &&
    transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction,
      query: {...location.query},
      projectID: project.id,
      view,
    });

  const projectScore =
    isProjectScoresLoading || isPending
      ? undefined
      : getWebVitalScoresFromTableDataRow(projectScores?.data?.[0]);

  const handleTabChange = (value: string) => {
    trackAnalytics('insight.vital.overview.toggle_tab', {
      organization,
      tab: value,
    });
    navigate({
      ...location,
      query: {
        ...location.query,
        tab: value,
      },
    });
  };

  return (
    <React.Fragment>
      <Tabs value={tab} onChange={handleTabChange}>
        <FrontendHeader
          headerTitle={
            <Fragment>
              {transaction && project && <ProjectAvatar project={project} size={24} />}
              {transaction ?? t('Page Loads')}
            </Fragment>
          }
          headerActions={
            transactionSummaryTarget && (
              <LinkButton
                to={transactionSummaryTarget}
                onClick={() => {
                  trackAnalytics('insight.vital.overview.open_transaction_summary', {
                    organization,
                  });
                }}
                size="sm"
              >
                {t('View Summary')}
              </LinkButton>
            )
          }
          hideDefaultTabs
          tabs={{
            value: tab,
            onTabChange: handleTabChange,
            tabList: (
              <TabList hideBorder>
                {LANDING_DISPLAYS.map(({label, field}) => (
                  <TabList.Item key={field}>{label}</TabList.Item>
                ))}
              </TabList>
            ),
          }}
          breadcrumbs={transaction ? [{label: 'Page Summary'}] : []}
          module={ModuleName.VITAL}
        />
        <ModuleBodyUpsellHook moduleName={ModuleName.VITAL}>
          {tab === LandingDisplayField.SPANS ? (
            <Layout.Body>
              <Layout.Main fullWidth>
                {defined(transaction) && <AggregateSpans transaction={transaction} />}
              </Layout.Main>
            </Layout.Body>
          ) : (
            <Layout.Body>
              <Layout.Main>
                <TopMenuContainer>
                  <ModulePageFilterBar moduleName={ModuleName.VITAL} />
                  <BrowserTypeSelector />
                </TopMenuContainer>
                <Flex>
                  <PerformanceScoreBreakdownChart
                    transaction={transaction}
                    browserTypes={browserTypes}
                    subregions={subregions}
                  />
                </Flex>
                <WebVitalMetersContainer>
                  <WebVitalMeters
                    projectData={pageData}
                    projectScore={projectScore}
                    onClick={webVital => {
                      router.replace({
                        pathname: location.pathname,
                        query: {...location.query, webVital},
                      });
                      setState({...state, webVital});
                    }}
                    transaction={transaction}
                    showTooltip={false}
                  />
                </WebVitalMetersContainer>
                <PageSamplePerformanceTableContainer>
                  <PageSamplePerformanceTable
                    transaction={transaction}
                    limit={15}
                    search={query}
                  />
                </PageSamplePerformanceTableContainer>
              </Layout.Main>
              <Layout.Side>
                <PageOverviewSidebar
                  projectScore={projectScore}
                  transaction={transaction}
                  projectScoreIsLoading={isPending}
                  browserTypes={browserTypes}
                  subregions={subregions}
                />
              </Layout.Side>
            </Layout.Body>
          )}
        </ModuleBodyUpsellHook>
        <PageOverviewWebVitalsDetailPanel
          webVital={state.webVital}
          onClose={() => {
            router.replace({
              pathname: router.location.pathname,
              query: omit(router.location.query, 'webVital'),
            });
            setState({...state, webVital: null});
          }}
        />
      </Tabs>
    </React.Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="vital">
      <PageOverview />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const TopMenuContainer = styled('div')`
  margin-bottom: ${space(1)};
  display: flex;
  gap: ${space(2)};
`;

const Flex = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  gap: ${space(1)};
`;

const PageSamplePerformanceTableContainer = styled('div')`
  margin-top: ${space(1)};
`;

const WebVitalMetersContainer = styled('div')`
  margin: ${space(2)} 0;
`;
