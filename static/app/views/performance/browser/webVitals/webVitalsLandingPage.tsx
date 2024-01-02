import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import WebVitalMeters from 'sentry/views/performance/browser/webVitals/components/webVitalMeters';
import {PagePerformanceTable} from 'sentry/views/performance/browser/webVitals/pagePerformanceTable';
import {PerformanceScoreChart} from 'sentry/views/performance/browser/webVitals/performanceScoreChart';
import {calculatePerformanceScoreFromTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {useProjectRawWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/calculatePerformanceScoreFromStored';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';
import {WebVitalsDetailPanel} from 'sentry/views/performance/browser/webVitals/webVitalsDetailPanel';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';
import Onboarding from 'sentry/views/performance/onboarding';

export default function WebVitalsLandingPage() {
  const organization = useOrganization();
  const location = useLocation();
  const onboardingProject = useOnboardingProject();
  const shouldUseStoredScores = useStoredScoresSetting();

  const router = useRouter();

  const [state, setState] = useState<{webVital: WebVitals | null}>({
    webVital: (location.query.webVital as WebVitals) ?? null,
  });

  const {data: projectData, isLoading} = useProjectRawWebVitalsQuery({});
  const {data: projectScores, isLoading: isProjectScoresLoading} =
    useProjectWebVitalsScoresQuery({enabled: shouldUseStoredScores});

  const noTransactions = !isLoading && !projectData?.data?.[0]?.['count()'];

  const projectScore =
    (shouldUseStoredScores && isProjectScoresLoading) || isLoading || noTransactions
      ? undefined
      : shouldUseStoredScores
      ? calculatePerformanceScoreFromStoredTableDataRow(projectScores?.data?.[0])
      : calculatePerformanceScoreFromTableDataRow(projectData?.data?.[0]);

  return (
    <ModulePageProviders title={[t('Performance'), t('Web Vitals')].join(' — ')}>
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
                label: 'Web Vitals',
              },
            ]}
          />

          <Layout.Title>{t('Web Vitals')}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <FloatingFeedbackWidget />
        <Layout.Main fullWidth>
          <TopMenuContainer>
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter />
            </PageFilterBar>
          </TopMenuContainer>

          {onboardingProject && (
            <OnboardingContainer>
              <Onboarding organization={organization} project={onboardingProject} />
            </OnboardingContainer>
          )}
          {!onboardingProject && (
            <Fragment>
              <PerformanceScoreChartContainer>
                <PerformanceScoreChart
                  projectScore={projectScore}
                  isProjectScoreLoading={
                    isLoading || (shouldUseStoredScores && isProjectScoresLoading)
                  }
                  webVital={state.webVital}
                />
              </PerformanceScoreChartContainer>
              <WebVitalMetersContainer>
                <WebVitalMeters
                  projectData={projectData}
                  projectScore={projectScore}
                  onClick={webVital => setState({...state, webVital})}
                />
              </WebVitalMetersContainer>
              <PagePerformanceTable />
            </Fragment>
          )}
        </Layout.Main>
      </Layout.Body>
      <WebVitalsDetailPanel
        webVital={state.webVital}
        onClose={() => {
          router.replace({
            pathname: router.location.pathname,
            query: omit(router.location.query, 'webVital'),
          });
          setState({...state, webVital: null});
        }}
      />
    </ModulePageProviders>
  );
}

const TopMenuContainer = styled('div')`
  display: flex;
`;

const PerformanceScoreChartContainer = styled('div')`
  margin-bottom: ${space(1)};
`;

const OnboardingContainer = styled('div')`
  margin-top: ${space(2)};
`;

const WebVitalMetersContainer = styled('div')`
  margin-bottom: ${space(4)};
`;
