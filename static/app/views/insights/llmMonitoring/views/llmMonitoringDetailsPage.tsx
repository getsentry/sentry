import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
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
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import {
  NumberOfPipelinesChart,
  PipelineDurationChart,
  TotalTokensUsedChart,
} from 'sentry/views/insights/llmMonitoring/components/charts/llmMonitoringCharts';
import {PipelineSpansTable} from 'sentry/views/insights/llmMonitoring/components/tables/pipelineSpansTable';
import {RELEASE_LEVEL} from 'sentry/views/insights/llmMonitoring/settings';
import {
  SpanFunction,
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/insights/types';

interface Props {
  params: {
    groupId: string;
  };
}

type Query = {
  'span.description'?: string;
};

export function LLMMonitoringPage({params}: Props) {
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
      fields: ['sum(ai.total_tokens.used)', 'sum(ai.total_cost)'],
      enabled: Boolean(groupId),
    },
    'api.ai-pipelines.view'
  );
  const tokenUsedMetric = totalTokenData[0] ?? {};

  const crumbs = useModuleBreadcrumbs('ai');

  return (
    <Layout.Page>
      <NoProjectMessage organization={organization}>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                ...crumbs,
                {
                  label: t('Pipeline Summary'),
                },
              ]}
            />
            <Layout.Title>
              {spanDescription}
              <FeatureBadge type={RELEASE_LEVEL} />
            </Layout.Title>
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
                      value={tokenUsedMetric['sum(ai.total_tokens.used)']}
                      unit={'count'}
                      isLoading={isTotalTokenDataLoading}
                    />

                    <MetricReadout
                      title={t('Total Cost')}
                      value={tokenUsedMetric['sum(ai.total_cost)']}
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
  return (
    <ModulePageProviders
      moduleName="ai"
      pageTitle={t('Pipeline Summary')}
      features="insights-addon-modules"
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
