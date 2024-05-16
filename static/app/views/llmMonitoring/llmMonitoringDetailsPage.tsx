import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {CurrencyUnit, DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  NumberOfPipelinesChart,
  PipelineDurationChart,
  TotalTokensUsedChart,
} from 'sentry/views/llmMonitoring/llmMonitoringCharts';
import {PipelineSpansTable} from 'sentry/views/llmMonitoring/pipelineSpansTable';
import {BASE_URL} from 'sentry/views/llmMonitoring/settings';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {useAIModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';
import {
  SpanFunction,
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';

interface Props {
  params: {
    groupId: string;
  };
}

type Query = {
  'span.description'?: string;
};

export function LLMMonitoringPage({params}: Props) {
  const moduleURL = useAIModuleURL();
  const location = useLocation<Query>();

  const organization = useOrganization();
  const {groupId} = params;

  const spanDescription = decodeScalar(location.query?.['span.description']);

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    'span.category': 'ai.pipeline',
  };

  const {data, isLoading: areSpanMetricsLoading} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: [
        SpanMetricsField.SPAN_OP,
        'count()',
        `${SpanFunction.SPM}()`,
        `avg(${SpanMetricsField.SPAN_DURATION})`,
      ],
      enabled: Boolean(groupId),
    },
    'api.ai-pipelines.view'
  );
  const spanMetrics = data[0] ?? {};

  const {data: totalTokenData, isLoading: isTotalTokenDataLoading} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject({
        'span.category': 'ai',
        'span.ai.pipeline.group': groupId,
      }),
      fields: [
        'ai_total_tokens_used()',
        'ai_total_tokens_used(c:spans/ai.total_cost@usd)',
      ],
      enabled: Boolean(groupId),
    },
    'api.ai-pipelines.view'
  );
  const tokenUsedMetric = totalTokenData[0] ?? {};

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
                  label: t('LLM Monitoring'),
                  to: moduleURL,
                },
                {
                  label: spanDescription ?? t('(no name)'),
                },
              ]}
            />
            <Layout.Title>{t('LLM Monitoring')}</Layout.Title>
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
                      title={t('Total Cost')}
                      value={
                        tokenUsedMetric['ai_total_tokens_used(c:spans/ai.total_cost@usd)']
                      }
                      unit={CurrencyUnit.USD}
                      isLoading={isTotalTokenDataLoading}
                    />

                    <MetricReadout
                      title={t('Pipeline Duration')}
                      value={spanMetrics?.[`avg(${SpanMetricsField.SPAN_DURATION})`]}
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
    </Layout.Page>
  );
}

function PageWithProviders({params}: Props) {
  const location = useLocation<Query>();

  const {'span.description': spanDescription} = location.query;

  return (
    <ModulePageProviders
      title={[spanDescription ?? t('(no name)'), t('Pipeline Details')].join(' — ')}
      baseURL={BASE_URL}
      features="ai-analytics"
    >
      <LLMMonitoringPage params={params} />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const SpaceBetweenWrap = styled('div')`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const MetricsRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;
