import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {
  NumberOfPipelinesChart,
  PipelineDurationChart,
  TotalTokensUsedChart,
} from 'sentry/views/aiMonitoring/aiMonitoringCharts';
import {PipelinesTable} from 'sentry/views/aiMonitoring/PipelinesTable';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';

function NoAccessComponent() {
  return (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}

export default function AiMonitoringPage() {
  const organization = useOrganization();

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle title={`AI Monitoring — ${organization.slug}`}>
        <Layout.Page>
          <Feature
            features="ai-analytics"
            organization={organization}
            renderDisabled={NoAccessComponent}
          >
            <NoProjectMessage organization={organization}>
              <Layout.Header>
                <Layout.HeaderContent>
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
                  </ModuleLayout.Layout>
                </Layout.Main>
              </Layout.Body>
            </NoProjectMessage>
          </Feature>
        </Layout.Page>
      </SentryDocumentTitle>
    </PageFiltersContainer>
  );
}
