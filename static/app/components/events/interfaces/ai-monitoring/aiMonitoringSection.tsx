import Alert from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  NumberOfPipelinesChart,
  TotalTokensUsedChart,
} from 'sentry/views/aiMonitoring/aiMonitoringCharts';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import {type IndexedResponse, SpanIndexedField} from 'sentry/views/starfish/types';

interface Props {
  event: Event;
  organization: Organization;
}

export default function AIMonitoringSection({event, organization}: Props) {
  const traceId = event.contexts.trace?.trace_id;
  const spanId = event.contexts.trace?.span_id;
  const {data, error, isLoading} = useIndexedSpans({
    limit: 1,
    fields: [SpanIndexedField.SPAN_AI_PIPELINE_GROUP],
    referrer: 'api.ai-pipelines.view',
    search: new MutableSearch(`trace:${traceId} id:"${spanId}"`),
  });
  const aiPipelineGroup =
    data && (data[0] as IndexedResponse)?.[SpanIndexedField.SPAN_AI_PIPELINE_GROUP];

  const actions = (
    <ButtonBar gap={1}>
      <LinkButton
        size="xs"
        icon={<IconOpen />}
        to={`/organizations/${organization.slug}/ai-monitoring/`}
      >
        {t('View in AI Monitoring')}
      </LinkButton>
    </ButtonBar>
  );

  return (
    <EventDataSection
      title={t('AI monitoring')}
      type="ai-monitoring"
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
    </EventDataSection>
  );
}
