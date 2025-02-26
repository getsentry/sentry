import {Fragment} from 'react';

import FeatureBadge from 'sentry/components/core/badge/featureBadge';
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
import {
  useEAPSpans,
  useSpanMetrics,
} from 'sentry/views/insights/common/queries/useDiscover';
import {
  EAPNumberOfPipelinesChart,
  EAPPipelineDurationChart,
  EAPTotalTokensUsedChart,
  NumberOfPipelinesChart,
  PipelineDurationChart,
  TotalTokensUsedChart,
} from 'sentry/views/insights/llmMonitoring/components/charts/llmMonitoringCharts';
import {PipelineSpansTable} from 'sentry/views/insights/llmMonitoring/components/tables/pipelineSpansTable';
import {RELEASE_LEVEL} from 'sentry/views/insights/llmMonitoring/settings';
import {AiHeader} from 'sentry/views/insights/pages/ai/aiPageHeader';
import {
  ModuleName,
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
  const useEAP = organization.features.includes('insights-use-eap');

  const {data: spanMetricData, isPending: areSpanMetricsLoading} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: [
        SpanMetricsField.SPAN_OP,
        'count()',
        `${SpanFunction.SPM}()`,
        `avg(${SpanMetricsField.SPAN_DURATION})`,
      ],
      enabled: Boolean(groupId) && !useEAP,
    },
    'api.ai-pipelines.details.view'
  );

  const {data: eapData, isPending: isEAPPending} = useEAPSpans(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: [
        SpanMetricsField.SPAN_OP,
        'count()',
        `${SpanFunction.SPM}()`,
        `avg(${SpanMetricsField.SPAN_DURATION})`,
      ],
      enabled: Boolean(groupId) && useEAP,
    },
    'api.ai-pipelines.details-eap.view'
  );
  const spanMetrics = (useEAP ? eapData[0] : spanMetricData[0]) ?? {};

  const {data: totalTokenData, isPending: isTotalTokenDataLoading} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject({
        'span.category': 'ai',
        'span.ai.pipeline.group': groupId,
      }),
      fields: ['sum(ai.total_tokens.used)', 'sum(ai.total_cost)'],
      enabled: Boolean(groupId) && !useEAP,
    },
    'api.ai-pipelines.details.view'
  );

  const {data: eapTokenData, isPending: isEAPTotalTokenDataLoading} = useEAPSpans(
    {
      search: MutableSearch.fromQueryObject({
        'span.category': 'ai',
        'span.ai.pipeline.group': groupId,
      }),
      fields: ['sum(ai.total_tokens.used)', 'sum(ai.total_cost)'],
      enabled: Boolean(groupId) && useEAP,
    },
    'api.ai-pipelines.details.view'
  );
  const tokenUsedMetric = (useEAP ? eapTokenData[0] : totalTokenData[0]) ?? {};

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
                        isLoading={
                          useEAP ? isEAPTotalTokenDataLoading : isTotalTokenDataLoading
                        }
                      />

                      <MetricReadout
                        title={t('Total Cost')}
                        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        value={tokenUsedMetric['sum(ai.total_cost)']}
                        unit={CurrencyUnit.USD}
                        isLoading={
                          useEAP ? isEAPTotalTokenDataLoading : isTotalTokenDataLoading
                        }
                      />

                      <MetricReadout
                        title={t('Pipeline Duration')}
                        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        value={spanMetrics?.[`avg(${SpanMetricsField.SPAN_DURATION})`]}
                        unit={DurationUnit.MILLISECOND}
                        isLoading={useEAP ? isEAPPending : areSpanMetricsLoading}
                      />

                      <MetricReadout
                        title={t('Pipeline Runs Per Minute')}
                        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        value={spanMetrics?.[`${SpanFunction.SPM}()`]}
                        unit={RateUnit.PER_MINUTE}
                        isLoading={useEAP ? isEAPPending : areSpanMetricsLoading}
                      />
                    </ReadoutRibbon>
                  </HeaderContainer>
                </ModuleLayout.Full>
                <ModuleLayout.Third>
                  {useEAP ? (
                    <EAPTotalTokensUsedChart groupId={groupId} />
                  ) : (
                    <TotalTokensUsedChart groupId={groupId} />
                  )}
                </ModuleLayout.Third>
                <ModuleLayout.Third>
                  {useEAP ? (
                    <EAPNumberOfPipelinesChart groupId={groupId} />
                  ) : (
                    <NumberOfPipelinesChart groupId={groupId} />
                  )}
                </ModuleLayout.Third>
                <ModuleLayout.Third>
                  {useEAP ? (
                    <EAPPipelineDurationChart groupId={groupId} />
                  ) : (
                    <PipelineDurationChart groupId={groupId} />
                  )}
                </ModuleLayout.Third>
                <ModuleLayout.Full>
                  <PipelineSpansTable groupId={groupId} useEAP={useEAP} />
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
