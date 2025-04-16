import {LinkButton} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {
  NumberOfPipelinesChart,
  TotalTokensUsedChart,
} from 'sentry/views/insights/llmMonitoring/components/charts/llmMonitoringCharts';
import {SpanIndexedField} from 'sentry/views/insights/types';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

interface Props {
  event: Event;
}

export default function LLMMonitoringSection({event}: Props) {
  const moduleUrl = useModuleURL('ai');
  const trace = event.contexts.trace;

  const {data} = useSpansIndexed(
    {
      limit: 1,
      fields: [SpanIndexedField.SPAN_AI_PIPELINE_GROUP],
      search: new MutableSearch(`trace:${trace?.trace_id} id:"${trace?.span_id}"`),
      enabled: Boolean(trace?.span_id) && Boolean(trace?.trace_id),
    },
    'api.ai-pipelines.view'
  );

  const aiPipelineGroup = data[0]?.[SpanIndexedField.SPAN_AI_PIPELINE_GROUP];

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
      {aiPipelineGroup ? (
        <ModuleLayout.Layout>
          <ModuleLayout.Half>
            <TotalTokensUsedChart groupId={aiPipelineGroup} />
          </ModuleLayout.Half>
          <ModuleLayout.Half>
            <NumberOfPipelinesChart groupId={aiPipelineGroup} />
          </ModuleLayout.Half>
        </ModuleLayout.Layout>
      ) : (
        'loading'
      )}
    </InterimSection>
  );
}
