import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ReadoutRibbon, ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {getTimeSpentExplanation} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import {LatencyChart} from 'sentry/views/insights/queues/charts/latencyChart';
import {ThroughputChart} from 'sentry/views/insights/queues/charts/throughputChart';
import {MessageSpanSamplesPanel} from 'sentry/views/insights/queues/components/messageSpanSamplesPanel';
import {TransactionsTable} from 'sentry/views/insights/queues/components/tables/transactionsTable';
import {useQueuesMetricsQuery} from 'sentry/views/insights/queues/queries/useQueuesMetricsQuery';
import {Referrer} from 'sentry/views/insights/queues/referrers';
import {DESTINATION_TITLE} from 'sentry/views/insights/queues/settings';
import Onboarding from 'sentry/views/performance/onboarding';

function DestinationSummaryPage() {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();

  const {query} = useLocation();
  const destination = decodeScalar(query.destination);

  const {data, isPending} = useQueuesMetricsQuery({
    destination,
    referrer: Referrer.QUEUES_SUMMARY,
  });
  const errorRate = 1 - (data[0]?.['trace_status_rate(ok)'] ?? 0);

  const crumbs = useModuleBreadcrumbs('queue');

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              ...crumbs,
              {
                label: DESTINATION_TITLE,
              },
            ]}
          />

          <Layout.Title>{destination}</Layout.Title>
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
                <ToolRibbon>
                  <PageFilterBar condensed>
                    <ProjectPageFilter />
                    <EnvironmentPageFilter />
                    <DatePageFilter />
                  </PageFilterBar>
                </ToolRibbon>

                {!onboardingProject && (
                  <ReadoutRibbon>
                    <MetricReadout
                      title={t('Avg Time In Queue')}
                      value={data[0]?.['avg(messaging.message.receive.latency)']}
                      unit={DurationUnit.MILLISECOND}
                      isLoading={isPending}
                    />
                    <MetricReadout
                      title={t('Avg Processing Time')}
                      value={data[0]?.['avg_if(span.duration,span.op,queue.process)']}
                      unit={DurationUnit.MILLISECOND}
                      isLoading={isPending}
                    />
                    <MetricReadout
                      title={t('Error Rate')}
                      value={errorRate}
                      unit={'percentage'}
                      isLoading={isPending}
                    />
                    <MetricReadout
                      title={t('Published')}
                      value={data[0]?.['count_op(queue.publish)']}
                      unit={'count'}
                      isLoading={isPending}
                    />
                    <MetricReadout
                      title={t('Processed')}
                      value={data[0]?.['count_op(queue.process)']}
                      unit={'count'}
                      isLoading={isPending}
                    />
                    <MetricReadout
                      title={t('Time Spent')}
                      value={data[0]?.['sum(span.duration)']}
                      unit={DurationUnit.MILLISECOND}
                      tooltip={getTimeSpentExplanation(
                        data[0]?.['time_spent_percentage(app,span.duration)']
                      )}
                      isLoading={isPending}
                    />
                  </ReadoutRibbon>
                )}
              </HeaderContainer>
            </ModuleLayout.Full>

            {onboardingProject && (
              <Onboarding organization={organization} project={onboardingProject} />
            )}

            {!onboardingProject && (
              <Fragment>
                <ModuleLayout.Half>
                  <LatencyChart
                    destination={destination}
                    referrer={Referrer.QUEUES_SUMMARY_CHARTS}
                  />
                </ModuleLayout.Half>

                <ModuleLayout.Half>
                  <ThroughputChart
                    destination={destination}
                    referrer={Referrer.QUEUES_SUMMARY_CHARTS}
                  />
                </ModuleLayout.Half>

                <ModuleLayout.Full>
                  <Flex>
                    <TransactionsTable />
                  </Flex>
                </ModuleLayout.Full>
              </Fragment>
            )}
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
      <MessageSpanSamplesPanel />
    </Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName="queue"
      pageTitle={t('Destination Summary')}
      features="insights-addon-modules"
    >
      <DestinationSummaryPage />
    </ModulePageProviders>
  );
}
export default PageWithProviders;

const Flex = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
