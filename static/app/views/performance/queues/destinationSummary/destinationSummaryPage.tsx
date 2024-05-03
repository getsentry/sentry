import {Fragment} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import Onboarding from 'sentry/views/performance/onboarding';
import {LatencyChart} from 'sentry/views/performance/queues/charts/latencyChart';
import {ThroughputChart} from 'sentry/views/performance/queues/charts/throughputChart';
import {TransactionsTable} from 'sentry/views/performance/queues/destinationSummary/transactionsTable';
import {MessageConsumerSamplesPanel} from 'sentry/views/performance/queues/messageConsumerSamplesPanel';
import {useQueuesMetricsQuery} from 'sentry/views/performance/queues/queries/useQueuesMetricsQuery';
import {
  DESTINATION_TITLE,
  MODULE_TITLE,
  RELEASE_LEVEL,
} from 'sentry/views/performance/queues/settings';

function DestinationSummaryPage() {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();

  const {query} = useLocation();
  const destination = decodeScalar(query.destination);

  const {data} = useQueuesMetricsQuery({destination});
  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: t('Performance'),
                to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                preservePageFilters: true,
              },
              {
                label: MODULE_TITLE,
                to: normalizeUrl(
                  `/organizations/${organization.slug}/performance/queues/`
                ),
                preservePageFilters: true,
              },
              {
                label: DESTINATION_TITLE,
              },
            ]}
          />

          <Layout.Title>
            {destination}
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
              <HeaderContainer>
                <PageFilterBar condensed>
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </PageFilterBar>

                {!onboardingProject && (
                  <MetricsRibbon>
                    <MetricReadout
                      title={t('Avg Time In Queue')}
                      value={data[0]?.['avg(messaging.message.receive.latency)']}
                      unit={DurationUnit.MILLISECOND}
                      isLoading={false}
                    />
                    <MetricReadout
                      title={t('Avg Processing Latency')}
                      value={data[0]?.['avg_if(span.self_time,span.op,queue.process)']}
                      unit={DurationUnit.MILLISECOND}
                      isLoading={false}
                    />
                    <MetricReadout
                      title={t('Error Rate')}
                      value={undefined}
                      unit={'percentage'}
                      isLoading={false}
                    />
                    <MetricReadout
                      title={t('Published')}
                      value={data[0]?.['count_op(queue.publish)']}
                      unit={'count'}
                      isLoading={false}
                    />
                    <MetricReadout
                      title={t('Processed')}
                      value={data[0]?.['count_op(queue.process)']}
                      unit={'count'}
                      isLoading={false}
                    />
                    <MetricReadout
                      title={t('Time Spent')}
                      value={data[0]?.['sum(span.self_time)']}
                      unit={DurationUnit.MILLISECOND}
                      isLoading={false}
                    />
                  </MetricsRibbon>
                )}
              </HeaderContainer>
            </ModuleLayout.Full>

            {onboardingProject && (
              <Onboarding organization={organization} project={onboardingProject} />
            )}

            {!onboardingProject && (
              <Fragment>
                <ModuleLayout.Half>
                  <LatencyChart />
                </ModuleLayout.Half>

                <ModuleLayout.Half>
                  <ThroughputChart />
                </ModuleLayout.Half>

                <ModuleLayout.Full>
                  <Flex>
                    {/* TODO: Make search bar work */}
                    <SmartSearchBar />
                    <TransactionsTable />
                  </Flex>
                </ModuleLayout.Full>
              </Fragment>
            )}
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
      <MessageConsumerSamplesPanel />
    </Fragment>
  );
}

function DestinationSummaryPageWithProviders() {
  return (
    <ModulePageProviders
      title={[t('Performance'), MODULE_TITLE].join(' — ')}
      baseURL="/performance/queues"
      features="performance-queues-view"
    >
      <DestinationSummaryPage />
    </ModulePageProviders>
  );
}
export default DestinationSummaryPageWithProviders;

const Flex = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const MetricsRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;

const HeaderContainer = styled('div')`
  display: flex;
  justify-content: space-between;
`;
