import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {useHasDataTrackAnalytics} from 'sentry/views/insights/common/utils/useHasDataTrackAnalytics';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import {
  NumberOfPipelinesChart,
  PipelineDurationChart,
  TotalTokensUsedChart,
} from 'sentry/views/insights/llmMonitoring/components/charts/llmMonitoringCharts';
import {PipelinesTable} from 'sentry/views/insights/llmMonitoring/components/tables/pipelinesTable';
import {
  MODULE_DOC_LINK,
  MODULE_TITLE,
  RELEASE_LEVEL,
} from 'sentry/views/insights/llmMonitoring/settings';
import {ModuleName} from 'sentry/views/insights/types';

export function LLMMonitoringPage() {
  const organization = useOrganization();

  const crumbs = useModuleBreadcrumbs('ai');

  useHasDataTrackAnalytics(ModuleName.AI, 'insight.page_loads.ai');

  return (
    <Layout.Page>
      <NoProjectMessage organization={organization}>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={crumbs} />
            <Layout.Title>
              {MODULE_TITLE}
              <PageHeadingQuestionTooltip
                title={t('View analytics and information about your AI pipelines')}
                docsUrl={MODULE_DOC_LINK}
              />
              <FeatureBadge type={RELEASE_LEVEL} />
            </Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <FeedbackWidgetButton />
            </ButtonBar>
          </Layout.HeaderActions>
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
              <ModulesOnboarding moduleName={ModuleName.AI}>
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
              </ModulesOnboarding>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </NoProjectMessage>
    </Layout.Page>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="ai" features="insights-addon-modules">
      <LLMMonitoringPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
