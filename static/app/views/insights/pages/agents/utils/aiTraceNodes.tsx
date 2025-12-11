import type {EventTransaction} from 'sentry/types/event';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  getGenAiOperationTypeFromSpanOp,
  getIsAiAgentSpan,
  getIsAiGenerationSpan,
  getIsExecuteToolSpan,
} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

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
  node: TraceTreeNode<TraceTree.NodeValue>,
  event?: EventTransaction,
  attributes?: TraceItemResponseAttribute[]
) {
  if (isEAPSpanNode(node) && attributes) {
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

  if (isTransactionNode(node) && event) {
    return event.contexts.trace?.data;
  }

  if (isSpanNode(node)) {
    return node.value.data;
  }

  return undefined;
}

/**
 * Returns the `gen_ai.operation.type` for a given trace node.
 * If the attribute is not present it will deduce it from the `span.op`
 *
 * **Note:** To keep the complexity manageable, this logic does not work for the edge case of transactions without `span.op` on the old data model.
 */
export function getGenAiOpType(
  node: TraceTreeNode<TraceTree.NodeValue>
): string | undefined {
  if (!isTransactionNode(node) && !isSpanNode(node) && !isEAPSpanNode(node)) {
    return undefined;
  }

  const op = isTransactionNode(node) ? node.value?.['transaction.op'] : node.value?.op;
  const attributeObject = isSpanNode(node)
    ? node.value.data
    : isEAPSpanNode(node)
      ? node.value.additional_attributes
      : undefined;

  return (
    attributeObject?.[SpanFields.GEN_AI_OPERATION_TYPE] ??
    getGenAiOperationTypeFromSpanOp(op)
  );
}

export function getTraceNodeAttribute(
  name: string,
  node: TraceTreeNode<TraceTree.NodeValue>,
  event?: EventTransaction,
  attributes?: TraceItemResponseAttribute[]
): string | number | boolean | undefined {
  const attributeObject = ensureAttributeObject(node, event, attributes);
  return attributeObject?.[name];
}

function createGetIsAiNode(predicate: (genAiOpType: string | undefined) => boolean) {
  return (node: TraceTreeNode<TraceTree.NodeValue>): node is AITraceSpanNode => {
    if (!isTransactionNode(node) && !isSpanNode(node) && !isEAPSpanNode(node)) {
      return false;
    }

    return predicate(getGenAiOpType(node));
  };
}

export const getIsAiNode = createGetIsAiNode(genAiOpType => Boolean(genAiOpType));
export const getIsAiAgentNode = createGetIsAiNode(getIsAiAgentSpan);
export const getIsAiGenerationNode = createGetIsAiNode(getIsAiGenerationSpan);
export const getIsExecuteToolNode = createGetIsAiNode(getIsExecuteToolSpan);
