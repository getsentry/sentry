import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  NumberOfPipelinesChart,
  PipelineDurationChart,
  TotalTokensUsedChart,
} from 'sentry/views/aiMonitoring/aiMonitoringCharts';
import {PipelineSpansTable} from 'sentry/views/aiMonitoring/pipelineSpansTable';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {
  SpanFunction,
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';

function NoAccessComponent() {
  return (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}
interface Props {
  params: {
    groupId: string;
  };
}

export default function AiMonitoringPage({params}: Props) {
  const organization = useOrganization();
  const {groupId} = params;

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    'span.category': 'ai.pipeline',
  };

  const {data, isLoading: areSpanMetricsLoading} = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
    fields: [
      SpanMetricsField.SPAN_OP,
      SpanMetricsField.SPAN_DESCRIPTION,
      'count()',
      `${SpanFunction.SPM}()`,
      `avg(${SpanMetricsField.SPAN_DURATION})`,
    ],
    enabled: Boolean(groupId),
    referrer: 'api.ai-pipelines.view',
  });
  const spanMetrics = data[0] ?? {};

  const {data: totalTokenData, isLoading: isTotalTokenDataLoading} = useSpanMetrics({
    search: MutableSearch.fromQueryObject({
      'span.category': 'ai',
      'span.ai.pipeline.group': groupId,
    }),
    fields: ['ai_total_tokens_used()'],
    enabled: Boolean(groupId),
    referrer: 'api.ai-pipelines.view',
  });
  const tokenUsedMetric = totalTokenData[0] ?? {};

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle
        title={`AI Monitoring — ${spanMetrics['span.description'] ?? t('(no name)')}`}
      >
        <Layout.Page>
          <Feature
            features="ai-analytics"
            organization={organization}
            renderDisabled={NoAccessComponent}
          >
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
                      {
                        label: spanMetrics['span.description'] ?? t('(no name)'),
                        to: normalizeUrl(
                          `/organizations/${organization.slug}/ai-monitoring`
                        ),
                      },
                    ]}
                  />
                  <Layout.Title>{t('AI Monitoring')}</Layout.Title>
                </Layout.HeaderContent>
              </Layout.Header>
              <Layout.Body>
                <Layout.Main fullWidth>
                  <ModuleLayout.Layout>
                    <ModuleLayout.Full>
                      <SpaceBetweenWrap>
                        <PageFilterBar condensed>
                          <ProjectPageFilter />
                          <EnvironmentPageFilter />
                          <DatePageFilter />
                        </PageFilterBar>
                        <MetricsRibbon>
                          <MetricReadout
                            title={t('Total Tokens Used')}
                            value={tokenUsedMetric['ai_total_tokens_used()']}
                            unit={'count'}
                            isLoading={isTotalTokenDataLoading}
                          />

                          <MetricReadout
                            title={t('Pipeline Duration')}
                            value={
                              spanMetrics?.[`avg(${SpanMetricsField.SPAN_DURATION})`]
                            }
                            unit={DurationUnit.MILLISECOND}
                            isLoading={areSpanMetricsLoading}
                          />

                          <MetricReadout
                            title={t('Pipeline Runs Per Minute')}
                            value={spanMetrics?.[`${SpanFunction.SPM}()`]}
                            unit={RateUnit.PER_MINUTE}
                            isLoading={areSpanMetricsLoading}
                          />
                        </MetricsRibbon>
                      </SpaceBetweenWrap>
                    </ModuleLayout.Full>
                    <ModuleLayout.Third>
                      <TotalTokensUsedChart groupId={groupId} />
                    </ModuleLayout.Third>
                    <ModuleLayout.Third>
                      <NumberOfPipelinesChart groupId={groupId} />
                    </ModuleLayout.Third>
                    <ModuleLayout.Third>
                      <PipelineDurationChart groupId={groupId} />
                    </ModuleLayout.Third>
                    <ModuleLayout.Full>
                      <PipelineSpansTable groupId={groupId} />
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

const SpaceBetweenWrap = styled('div')`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
`;

const MetricsRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;
