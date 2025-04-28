import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanIndexedField} from 'sentry/views/insights/types';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';

/**
 * Given an issue's groupId + eventId, fetch the AI
 * Pipeline's group ID via event's trace
 */
export function useAiPipelineGroup({
  groupId,
  eventId,
}: {
  groupId: string;
  eventId?: string;
}) {
  const {
    data: event,
    isPending: isGroupPending,
    error: groupError,
  } = useGroupEvent({groupId, eventId});

  const trace = event?.contexts.trace;
  const {
    data,
    isPending: isSpanPending,
    error: spanError,
  } = useSpansIndexed(
    {
      limit: 1,
      fields: [SpanIndexedField.SPAN_AI_PIPELINE_GROUP],
      search: new MutableSearch(`trace:${trace?.trace_id} id:"${trace?.span_id}"`),
      enabled: Boolean(trace?.span_id) && Boolean(trace?.trace_id),
    },
    'api.ai-pipelines.view'
  );

  return {
    groupId: data[0]?.[SpanIndexedField.SPAN_AI_PIPELINE_GROUP],
    isPending: isGroupPending || isSpanPending,
    error: groupError || spanError,
  };
}
