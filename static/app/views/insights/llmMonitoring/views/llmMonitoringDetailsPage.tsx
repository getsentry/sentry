import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {CurrencyUnit, DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ReadoutRibbon, ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {
  useEAPSpans,
  useSpanMetrics,
} from 'sentry/views/insights/common/queries/useDiscover';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
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
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
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
  const {isInDomainView} = useDomainViewFilters();
  const location = useLocation<Query>();

  const organization = useOrganization();
  const {groupId} = params;

  const spanDescription = decodeScalar(location.query?.['span.description']);

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    'span.category': 'ai.pipeline',
  };
  const useEAP = organization?.features?.includes('insights-use-eap');

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

  const crumbs = useModuleBreadcrumbs('ai');

  return (
    <Layout.Page>
      <NoProjectMessage organization={organization}>
        {!isInDomainView && (
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
        )}

        {isInDomainView && (
          <Layout.Header>
            <AiHeader module={ModuleName.AI} />
          </Layout.Header>
        )}
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

                  <ReadoutRibbon>
                    <MetricReadout
                      title={t('Total Tokens Used')}
                      value={tokenUsedMetric['sum(ai.total_tokens.used)']}
                      unit={'count'}
                      isLoading={
                        useEAP ? isEAPTotalTokenDataLoading : isTotalTokenDataLoading
                      }
                    />

                    <MetricReadout
                      title={t('Total Cost')}
                      value={tokenUsedMetric['sum(ai.total_cost)']}
                      unit={CurrencyUnit.USD}
                      isLoading={
                        useEAP ? isEAPTotalTokenDataLoading : isTotalTokenDataLoading
                      }
                    />

                    <MetricReadout
                      title={t('Pipeline Duration')}
                      value={spanMetrics?.[`avg(${SpanMetricsField.SPAN_DURATION})`]}
                      unit={DurationUnit.MILLISECOND}
                      isLoading={useEAP ? isEAPPending : areSpanMetricsLoading}
                    />

                    <MetricReadout
                      title={t('Pipeline Runs Per Minute')}
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
