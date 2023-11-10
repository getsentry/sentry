import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/button';
import FeedbackWidget from 'sentry/components/feedback/widget/feedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import WebVitalMeters from 'sentry/views/performance/browser/webVitals/components/webVitalMeters';
import {PagePerformanceTable} from 'sentry/views/performance/browser/webVitals/pagePerformanceTable';
import {PageSamplePerformanceTable} from 'sentry/views/performance/browser/webVitals/pageSamplePerformanceTable';
import {PerformanceScoreChart} from 'sentry/views/performance/browser/webVitals/performanceScoreChart';
import {calculatePerformanceScoreFromTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import {WebVitalsDetailPanel} from 'sentry/views/performance/browser/webVitals/webVitalsDetailPanel';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';
import Onboarding from 'sentry/views/performance/onboarding';

export default function WebVitalsLandingPage() {
  const organization = useOrganization();
  const location = useLocation();
  const {projects} = useProjects();
  const onboardingProject = useOnboardingProject();

  const router = useRouter();
  const transaction = location.query.transaction
    ? Array.isArray(location.query.transaction)
      ? location.query.transaction[0]
      : location.query.transaction
    : undefined;

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const [state, setState] = useState<{webVital: WebVitals | null}>({
    webVital: (location.query.webVital as WebVitals) ?? null,
  });

  const {data: projectData, isLoading} = useProjectWebVitalsQuery({transaction});

  const noTransactions = !isLoading && projectData?.data[0]['count()'] === 0;

  const projectScore =
    isLoading || noTransactions
      ? undefined
      : calculatePerformanceScoreFromTableDataRow(projectData?.data[0]);

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
              ...(transaction ? [{label: 'Page Overview'}] : []),
            ]}
          />

          <Layout.Title>
            {transaction && project && <ProjectAvatar project={project} size={24} />}
            {transaction ?? t('Web Vitals')}
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <FeedbackWidget />
        <Layout.Main fullWidth>
          <TopMenuContainer>
            {transaction && (
              <ViewAllPagesButton
                to={{...location, query: {...location.query, transaction: undefined}}}
              >
                <IconChevron direction="left" /> {t('View All Pages')}
              </ViewAllPagesButton>
            )}
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
                  transaction={transaction}
                  isProjectScoreLoading={isLoading}
                  webVital={state.webVital}
                />
              </PerformanceScoreChartContainer>
              <WebVitalMeters
                projectData={projectData}
                projectScore={projectScore}
                onClick={webVital => setState({...state, webVital})}
                transaction={transaction}
              />
              {!transaction && <PagePerformanceTable />}
              {transaction && <PageSamplePerformanceTable transaction={transaction} />}
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

const ViewAllPagesButton = styled(LinkButton)`
  margin-right: ${space(1)};
`;

const TopMenuContainer = styled('div')`
  display: flex;
`;

const PerformanceScoreChartContainer = styled('div')`
  margin-bottom: ${space(1)};
`;

const OnboardingContainer = styled('div')`
  margin-top: ${space(2)};
`;
