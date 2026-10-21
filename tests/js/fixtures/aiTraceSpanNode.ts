import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

export function AiTraceSpanNodeFixture({
  id,
  operation,
  parent = null,
}: {
  id: string;
  operation: string;
  parent?: AITraceSpanNode | null;
}): AITraceSpanNode {
  const value = makeEAPSpan({
    event_id: id,
    op: `gen_ai.${operation}`,
    start_timestamp: 1000,
    end_timestamp: 1000.5,
    parent_span_id: parent?.id ?? null,
    additional_attributes: {
      [SpanFields.GEN_AI_OPERATION_TYPE]: operation,
      [SpanFields.GEN_AI_AGENT_NAME]: id,
      [SpanFields.GEN_AI_TOOL_NAME]: id,
      [SpanFields.GEN_AI_RESPONSE_MODEL]: id,
    },
  });

  return {
    id,
    type: 'span',
    parent,
    value,
    op: value.op,
    description: value.description,
    startTimestamp: value.start_timestamp,
    endTimestamp: value.end_timestamp,
    attributes: value.additional_attributes,
    errors: new Set(),
    findParent(predicate: (node: AITraceSpanNode) => boolean) {
      let current = parent;
      while (current) {
        if (predicate(current)) {
          return current;
        }
        current = current.parent as AITraceSpanNode | null;
      }
      return null;
    },
  } as unknown as AITraceSpanNode;
}
