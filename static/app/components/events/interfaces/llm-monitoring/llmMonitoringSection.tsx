import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {
  useEAPSpans,
  useSpansIndexed,
} from 'sentry/views/insights/common/queries/useDiscover';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {
  EAPNumberOfPipelinesChart,
  EAPTotalTokensUsedChart,
  NumberOfPipelinesChart,
  TotalTokensUsedChart,
} from 'sentry/views/insights/llmMonitoring/components/charts/llmMonitoringCharts';
import {
  type EAPSpanResponse,
  SpanIndexedField,
  type SpanIndexedResponse,
} from 'sentry/views/insights/types';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

interface Props {
  event: Event;
  organization: Organization;
}

function useAIPipelineGroup({
  useEAP,
  traceId,
  spanId,
}: {
  useEAP: boolean;
  spanId?: string;
  traceId?: string;
}): string | null {
  const {data: indexedData} = useSpansIndexed(
    {
      limit: 1,
      fields: [SpanIndexedField.SPAN_AI_PIPELINE_GROUP],
      search: new MutableSearch(`trace:${traceId} id:"${spanId}"`),
      enabled: !useEAP,
    },
    'api.ai-pipelines.view'
  );
  const {data: eapData} = useEAPSpans(
    {
      limit: 1,
      fields: [SpanIndexedField.SPAN_AI_PIPELINE_GROUP_TAG],
      search: new MutableSearch(`trace:${traceId} id:"${spanId}"`),
      enabled: useEAP,
    },
    'api.ai-pipelines-eap.view'
  );

  if (useEAP) {
    return (
      eapData &&
      (eapData[0] as EAPSpanResponse)?.[SpanIndexedField.SPAN_AI_PIPELINE_GROUP_TAG]
    );
  }
  return (
    indexedData &&
    (indexedData[0] as SpanIndexedResponse)?.[SpanIndexedField.SPAN_AI_PIPELINE_GROUP]
  );
}

export default function LLMMonitoringSection({event, organization}: Props) {
  const moduleUrl = useModuleURL('ai');
  const aiPipelineGroup = useAIPipelineGroup({
    useEAP: organization.features.includes('insights-use-eap'),
    traceId: event.contexts.trace?.trace_id,
    spanId: event.contexts.trace?.span_id,
  });

  const actions = (
    <ButtonBar gap={1}>
      <LinkButton size="xs" icon={<IconOpen />} to={moduleUrl}>
        {t('View in LLM Monitoring')}
      </LinkButton>
    </ButtonBar>
  );
  const useEAP = organization.features.includes('insights-use-eap');

  return (
    <InterimSection
      title={t('LLM monitoring')}
      type={SectionKey.LLM_MONITORING}
      help={t('Charts showing how many tokens are being used')}
      actions={actions}
    >
      {!aiPipelineGroup ? (
        'loading'
      ) : (
        <ModuleLayout.Layout>
          <ModuleLayout.Half>
            {useEAP ? (
              <EAPTotalTokensUsedChart groupId={aiPipelineGroup} />
            ) : (
              <TotalTokensUsedChart groupId={aiPipelineGroup} />
            )}
          </ModuleLayout.Half>
          <ModuleLayout.Half>
            {useEAP ? (
              <EAPNumberOfPipelinesChart groupId={aiPipelineGroup} />
            ) : (
              <NumberOfPipelinesChart groupId={aiPipelineGroup} />
            )}
          </ModuleLayout.Half>
        </ModuleLayout.Layout>
      )}
    </InterimSection>
  );
}
