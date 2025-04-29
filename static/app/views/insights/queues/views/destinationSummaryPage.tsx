import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ReadoutRibbon, ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {getTimeSpentExplanation} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import QueuesSummaryLatencyChartWidget from 'sentry/views/insights/common/components/widgets/queuesSummaryLatencyChartWidget';
import QueuesSummaryThroughputChartWidget from 'sentry/views/insights/common/components/widgets/queuesSummaryThroughputChartWidget';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {useSamplesDrawer} from 'sentry/views/insights/common/utils/useSamplesDrawer';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {MessageSpanSamplesPanel} from 'sentry/views/insights/queues/components/messageSpanSamplesPanel';
import {TransactionsTable} from 'sentry/views/insights/queues/components/tables/transactionsTable';
import {useQueuesMetricsQuery} from 'sentry/views/insights/queues/queries/useQueuesMetricsQuery';
import {Referrer} from 'sentry/views/insights/queues/referrers';
import {DESTINATION_TITLE} from 'sentry/views/insights/queues/settings';
import {ModuleName} from 'sentry/views/insights/types';
import {LegacyOnboarding} from 'sentry/views/performance/onboarding';

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

  useSamplesDrawer({
    Component: <MessageSpanSamplesPanel />,
    moduleName: ModuleName.QUEUE,
    requiredParams: ['transaction'],
  });

  return (
    <Fragment>
      <BackendHeader
        headerTitle={destination}
        breadcrumbs={[
          {
            label: DESTINATION_TITLE,
          },
        ]}
        module={ModuleName.QUEUE}
      />
      <ModuleBodyUpsellHook moduleName={ModuleName.QUEUE}>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <HeaderContainer>
                  <ToolRibbon>
                    <ModulePageFilterBar moduleName={ModuleName.QUEUE} />
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
                          data[0]?.['time_spent_percentage(span.duration)'] || 0
                        )}
                        isLoading={isPending}
                      />
                    </ReadoutRibbon>
                  )}
                </HeaderContainer>
              </ModuleLayout.Full>

              {onboardingProject && (
                <LegacyOnboarding
                  organization={organization}
                  project={onboardingProject}
                />
              )}

              {!onboardingProject && (
                <Fragment>
                  <ModuleLayout.Half>
                    <QueuesSummaryLatencyChartWidget />
                  </ModuleLayout.Half>

                  <ModuleLayout.Half>
                    <QueuesSummaryThroughputChartWidget />
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
      </ModuleBodyUpsellHook>
    </Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="queue" pageTitle={t('Destination Summary')}>
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
