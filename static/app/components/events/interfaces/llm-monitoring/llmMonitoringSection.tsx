import Alert from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {
  NumberOfPipelinesChart,
  TotalTokensUsedChart,
} from 'sentry/views/insights/llmMonitoring/components/charts/llmMonitoringCharts';
import {SpanIndexedField, type SpanIndexedResponse} from 'sentry/views/insights/types';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

interface Props {
  event: Event;
  organization: Organization;
}

export default function LLMMonitoringSection({event}: Props) {
  const traceId = event.contexts.trace?.trace_id;
  const spanId = event.contexts.trace?.span_id;
  const {data, error, isLoading} = useSpansIndexed(
    {
      limit: 1,
      fields: [SpanIndexedField.SPAN_AI_PIPELINE_GROUP],
      search: new MutableSearch(`trace:${traceId} id:"${spanId}"`),
    },
    'api.ai-pipelines.view'
  );
  const moduleUrl = useModuleURL('ai');
  const aiPipelineGroup =
    data && (data[0] as SpanIndexedResponse)?.[SpanIndexedField.SPAN_AI_PIPELINE_GROUP];

  const actions = (
    <ButtonBar gap={1}>
      <LinkButton size="xs" icon={<IconOpen />} to={moduleUrl}>
        {t('View in LLM Monitoring')}
      </LinkButton>
    </ButtonBar>
  );

  return (
    <InterimSection
      title={t('LLM monitoring')}
      type={SectionKey.LLM_MONITORING}
      help={t('Charts showing how many tokens are being used')}
      actions={actions}
    >
      {error ? (
        <Alert type="error" showIcon>
          {'' + error}
        </Alert>
      ) : isLoading ? (
        'loading'
      ) : (
        <ModuleLayout.Layout>
          <ModuleLayout.Half>
            <TotalTokensUsedChart groupId={aiPipelineGroup} />
          </ModuleLayout.Half>
          <ModuleLayout.Half>
            <NumberOfPipelinesChart groupId={aiPipelineGroup} />
          </ModuleLayout.Half>
        </ModuleLayout.Layout>
      )}
    </InterimSection>
  );
}
