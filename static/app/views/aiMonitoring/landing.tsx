import {Fragment} from 'react';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {
  NumberOfPipelinesChart,
  PipelineDurationChart,
  TotalTokensUsedChart,
} from 'sentry/views/aiMonitoring/aiMonitoringCharts';
import {AIMonitoringOnboarding} from 'sentry/views/aiMonitoring/onboarding';
import {PipelinesTable} from 'sentry/views/aiMonitoring/PipelinesTable';
import {BASE_URL} from 'sentry/views/aiMonitoring/settings';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';

export function AiMonitoringPage() {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();
  const isOnboarding = !!onboardingProject;

  return (
    <Layout.Page>
      <NoProjectMessage organization={organization}>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: t('Dashboard'),
                },
                {
                  label: t('AI Monitoring'),
                },
              ]}
            />
            <Layout.Title>
              {t('AI Monitoring')}
              <PageHeadingQuestionTooltip
                title={t('View analytics and information about your AI pipelines')}
                docsUrl="https://docs.sentry.io/product/ai-monitoring/"
              />
            </Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <PageFilterBar condensed>
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </PageFilterBar>
              </ModuleLayout.Full>
              {isOnboarding ? (
                <ModuleLayout.Full>
                  <AIMonitoringOnboarding />
                </ModuleLayout.Full>
              ) : (
                <Fragment>
                  <ModuleLayout.Third>
                    <TotalTokensUsedChart />
                  </ModuleLayout.Third>
                  <ModuleLayout.Third>
                    <NumberOfPipelinesChart />
                  </ModuleLayout.Third>
                  <ModuleLayout.Third>
                    <PipelineDurationChart />
                  </ModuleLayout.Third>
                  <ModuleLayout.Full>
                    <PipelinesTable />
                  </ModuleLayout.Full>
                </Fragment>
              )}
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </NoProjectMessage>
    </Layout.Page>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      title={t('AI Monitoring')}
      baseURL={BASE_URL}
      features="ai-analytics"
    >
      <AiMonitoringPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
