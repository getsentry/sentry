import React, {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import BrowserTypeSelector from 'sentry/views/insights/browser/webVitals/components/browserTypeSelector';
import {PageOverviewSidebar} from 'sentry/views/insights/browser/webVitals/components/pageOverviewSidebar';
import {PageOverviewWebVitalsDetailPanel} from 'sentry/views/insights/browser/webVitals/components/pageOverviewWebVitalsDetailPanel';
import {PageSamplePerformanceTable} from 'sentry/views/insights/browser/webVitals/components/tables/pageSamplePerformanceTable';
import WebVitalMetersWithIssues from 'sentry/views/insights/browser/webVitals/components/webVitalMetersWithIssues';
import {useProjectRawWebVitalsQuery} from 'sentry/views/insights/browser/webVitals/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {getWebVitalScoresFromTableDataRow} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/getWebVitalScoresFromTableDataRow';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import decodeBrowserTypes from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import useHasDashboardsPlatformizedWebVitals from 'sentry/views/insights/browser/webVitals/utils/useHasDashboardsPlatformizedWebVitals';
import {PlatformizedWebVitalsPageOverview} from 'sentry/views/insights/browser/webVitals/views/platformizedPageOverview';
import {WebVitalMetersPlaceholder} from 'sentry/views/insights/browser/webVitals/views/webVitalsLandingPage';
import {ModuleFeature} from 'sentry/views/insights/common/components/moduleFeature';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import PerformanceScoreBreakdownChartWidget from 'sentry/views/insights/common/components/widgets/performanceScoreBreakdownChartWidget';
import {useModuleTitle} from 'sentry/views/insights/common/utils/useModuleTitle';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {useWebVitalsDrawer} from 'sentry/views/insights/common/utils/useWebVitalsDrawer';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {ModuleName, SpanFields, type SubregionCode} from 'sentry/views/insights/types';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

function PageOverview() {
  const moduleTitle = useModuleTitle(ModuleName.VITAL);
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

  // TODO: When visiting page overview from a specific webvital detail panel in the landing page,
  // we should automatically default this webvital state to the respective webvital so the detail
  // panel in this page opens automatically.
  const [state, setState] = useState<{webVital: WebVitals | null}>({
    webVital: (location.query.webVital as WebVitals) ?? null,
  });

  const query = decodeScalar(location.query.query);
  const browserTypes = decodeBrowserTypes(location.query[SpanFields.BROWSER_NAME]);
  const subregions = decodeList(
    location.query[SpanFields.USER_GEO_SUBREGION]
  ) as SubregionCode[];

  const {data: pageData, isPending} = useProjectRawWebVitalsQuery({
    transaction,
    browserTypes,
    subregions,
  });
  const {data: projectScores, isPending: isProjectScoresLoading} =
    useProjectWebVitalsScoresQuery({transaction, browserTypes, subregions});

  const {openVitalsDrawer} = useWebVitalsDrawer({
    Component: <PageOverviewWebVitalsDetailPanel webVital={state.webVital} />,
    webVital: state.webVital,
    onClose: () => {
      router.replace({
        pathname: router.location.pathname,
        query: omit(router.location.query, 'webVital'),
      });

      setState({...state, webVital: null});
    },
  });

  useEffect(() => {
    if (state.webVital) {
      openVitalsDrawer();
    }
  });

  if (transaction === undefined) {
    // redirect user to webvitals landing page
    testableWindowLocation.assign(moduleURL);
    return null;
  }

  const transactionSummaryTarget =
    project &&
    !Array.isArray(location.query.project) && // Only render button to transaction summary when one project is selected.
    transaction &&
    transactionSummaryRouteWithQuery({
      organization,
      transaction,
      query: {...location.query},
      projectID: project.id,
      view,
    });

  const projectScore =
    isProjectScoresLoading || isPending
      ? undefined
      : getWebVitalScoresFromTableDataRow(projectScores?.[0]);

  return (
    <React.Fragment>
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
        breadcrumbs={
          transaction
            ? [{label: moduleTitle, to: moduleURL}, {label: t('Page Summary')}]
            : []
        }
        module={ModuleName.VITAL}
        hideDefaultTabs
      />
      <ModuleFeature moduleName={ModuleName.VITAL}>
        <Layout.Body>
          <Layout.Main>
            <TopMenuContainer>
              <ModulePageFilterBar moduleName={ModuleName.VITAL} />
              <BrowserTypeSelector />
              <SubregionSelector />
            </TopMenuContainer>
            <Flex>
              <ChartContainer>
                <PerformanceScoreBreakdownChartWidget />
              </ChartContainer>
            </Flex>
            <WebVitalMetersContainer>
              {(isPending || isProjectScoresLoading) && <WebVitalMetersPlaceholder />}
              <WebVitalMetersWithIssues
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
      </ModuleFeature>
    </React.Fragment>
  );
}

function PageWithProviders() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  const hasDashboardsPlatformizedWebVitals = useHasDashboardsPlatformizedWebVitals();
  if (hasDashboardsPlatformizedWebVitals) {
    return <PlatformizedWebVitalsPageOverview />;
  }

  return (
    <ModulePageProviders
      moduleName="vital"
      maxPickableDays={maxPickableDays.maxPickableDays}
    >
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

const ChartContainer = styled('div')`
  flex: 1 1 0%;
`;

const PageSamplePerformanceTableContainer = styled('div')`
  margin-top: ${space(1)};
`;

const WebVitalMetersContainer = styled('div')`
  margin: ${space(2)} 0;
`;
