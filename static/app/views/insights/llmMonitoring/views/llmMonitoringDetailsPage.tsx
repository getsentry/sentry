import {Fragment} from 'react';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import {CurrencyUnit, DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ReadoutRibbon, ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import LlmGroupNumberOfPipelinesChartWidget from 'sentry/views/insights/common/components/widgets/llmGroupNumberOfPipelinesChartWidget';
import LlmGroupPipelineDurationChartWidget from 'sentry/views/insights/common/components/widgets/llmGroupPipelineDurationChartWidget';
import LlmGroupTotalTokensUsedChartWidget from 'sentry/views/insights/common/components/widgets/llmGroupTotalTokensUsedChartWidget';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {PipelineSpansTable} from 'sentry/views/insights/llmMonitoring/components/tables/pipelineSpansTable';
import {RELEASE_LEVEL} from 'sentry/views/insights/llmMonitoring/settings';
import {AiHeader} from 'sentry/views/insights/pages/ai/aiPageHeader';
import {
  ModuleName,
  SpanFields,
  SpanFunction,
  type SpanQueryFilters,
} from 'sentry/views/insights/types';

interface Props {
  params: {
    groupId: string;
  };
}

type Query = {
  'span.description'?: string;
};

function LLMMonitoringPage({params}: Props) {
  const location = useLocation<Query>();

  const organization = useOrganization();
  const {groupId} = params;

  const spanDescription = decodeScalar(location.query?.['span.description']);

  const filters: SpanQueryFilters = {
    'span.group': groupId,
    'span.category': 'ai.pipeline',
  };

  const {data, isPending: areSpanMetricsLoading} = useSpans(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: [
        SpanFields.SPAN_OP,
        'count()',
        `${SpanFunction.EPM}()`,
        `avg(${SpanFields.SPAN_DURATION})`,
      ],
      enabled: Boolean(groupId),
    },
    'api.ai-pipelines.details.view'
  );

  const spanMetrics = data[0] ?? {};

  const {data: totalTokenData, isPending: isTotalTokenDataLoading} = useSpans(
    {
      search: MutableSearch.fromQueryObject({
        'span.category': 'ai',
        'span.ai.pipeline.group': groupId,
      }),
      fields: ['sum(ai.total_tokens.used)', 'sum(ai.total_cost)'],
      enabled: Boolean(groupId),
    },
    'api.ai-pipelines.details.view'
  );

  const tokenUsedMetric = totalTokenData[0] ?? {};

  return (
    <Layout.Page>
      <NoProjectMessage organization={organization}>
        <AiHeader
          headerTitle={
            <Fragment>
              {spanDescription}
              <FeatureBadge type={RELEASE_LEVEL} />
            </Fragment>
          }
          breadcrumbs={[
            {
              label: t('Pipeline Summary'),
            },
          ]}
          module={ModuleName.AI}
        />
        <ModuleBodyUpsellHook moduleName={ModuleName.AI}>
          <Layout.Body>
            <Layout.Main fullWidth>
              <ModuleLayout.Layout>
                <ModuleLayout.Full>
                  <HeaderContainer>
                    <ToolRibbon>
                      <ModulePageFilterBar moduleName={ModuleName.AI} />
                    </ToolRibbon>

                    <ReadoutRibbon>
                      <MetricReadout
                        title={t('Total Tokens Used')}
                        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        value={tokenUsedMetric['sum(ai.total_tokens.used)']}
                        unit={'count'}
                        isLoading={isTotalTokenDataLoading}
                      />

                      <MetricReadout
                        title={t('Total Cost')}
                        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        value={tokenUsedMetric['sum(ai.total_cost)']}
                        unit={CurrencyUnit.USD}
                        isLoading={isTotalTokenDataLoading}
                      />

                      <MetricReadout
                        title={t('Pipeline Duration')}
                        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        value={spanMetrics?.[`avg(${SpanFields.SPAN_DURATION})`]}
                        unit={DurationUnit.MILLISECOND}
                        isLoading={areSpanMetricsLoading}
                      />

                      <MetricReadout
                        title={t('Pipeline Runs Per Minute')}
                        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        value={spanMetrics?.[`${SpanFunction.EPM}()`]}
                        unit={RateUnit.PER_MINUTE}
                        isLoading={areSpanMetricsLoading}
                      />
                    </ReadoutRibbon>
                  </HeaderContainer>
                </ModuleLayout.Full>
                <ModuleLayout.Third>
                  <LlmGroupTotalTokensUsedChartWidget />
                </ModuleLayout.Third>
                <ModuleLayout.Third>
                  <LlmGroupNumberOfPipelinesChartWidget />
                </ModuleLayout.Third>
                <ModuleLayout.Third>
                  <LlmGroupPipelineDurationChartWidget />
                </ModuleLayout.Third>
                <ModuleLayout.Full>
                  <PipelineSpansTable groupId={groupId} />
                </ModuleLayout.Full>
              </ModuleLayout.Layout>
            </Layout.Main>
          </Layout.Body>
        </ModuleBodyUpsellHook>
      </NoProjectMessage>
    </Layout.Page>
  );
}

function PageWithProviders({params}: Props) {
  return (
    <ModulePageProviders moduleName="ai" pageTitle={t('Pipeline Summary')}>
      <LLMMonitoringPage params={params} />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
