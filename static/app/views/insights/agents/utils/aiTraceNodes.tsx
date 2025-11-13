import type {EventTransaction} from 'sentry/types/event';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  getIsAiGenerationSpan,
  getIsAiRunSpan,
  getIsAiSpan,
  getIsExecuteToolSpan,
} from 'sentry/views/insights/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/agents/utils/types';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

// TODO(aknaus): Remove the special handling for tags once the endpoint returns the correct type
function getAttributeValue(
  attribute: TraceItemResponseAttribute
): string | number | boolean {
  if (!attribute.name.startsWith('tags[')) {
    return attribute.value;
  }
  if (attribute.type === 'int') {
    return Number(attribute.value);
  }
  if (attribute.type === 'float') {
    return Number(attribute.value);
  }
  if (attribute.type === 'bool') {
    /* @ts-expect-error - tags are always returned as strings */
    return attribute.value === 'true';
  }
  return attribute.value;
}

export function ensureAttributeObject(
  node: AITraceSpanNode,
  event?: EventTransaction,
  attributes?: TraceItemResponseAttribute[]
) {
  if (attributes) {
    return attributes.reduce(
      (acc, attribute) => {
        // Some attribute keys include prefixes and metadata (e.g. "tags[ai.prompt_tokens.used,number]")
        // prettifyAttributeName normalizes those
        acc[prettifyAttributeName(attribute.name)] = getAttributeValue(attribute);
        return acc;
      },
      {} as Record<string, string | number | boolean>
    );
  }

  if (event) {
    return event.contexts.trace?.data;
  }

  return node.attributes;
}

export function getTraceNodeAttribute(
  name: string,
  node: AITraceSpanNode,
  event?: EventTransaction,
  attributes?: TraceItemResponseAttribute[]
): string | number | boolean | undefined {
  const attributeObject = ensureAttributeObject(node, event, attributes);
  return attributeObject?.[name];
}

function createGetIsAiNode(predicate: ({op}: {op?: string}) => boolean) {
  return (node: BaseNode): node is AITraceSpanNode => {
    return predicate({op: node.op});
  };
}

export const getIsAiNode = createGetIsAiNode(getIsAiSpan);
export const getIsAiRunNode = createGetIsAiNode(getIsAiRunSpan);
export const getIsAiGenerationNode = createGetIsAiNode(getIsAiGenerationSpan);
export const getIsExecuteToolNode = createGetIsAiNode(getIsExecuteToolSpan);
