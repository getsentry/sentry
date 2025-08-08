import type {EventTransaction} from 'sentry/types/event';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {getIsAiRunSpan, getIsAiSpan} from 'sentry/views/insights/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/agents/utils/types';
import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

function ensureAttributeObject(
  attributes: Record<string, string> | TraceItemResponseAttribute[]
) {
  if (Array.isArray(attributes)) {
    return attributes.reduce(
      (acc, attribute) => {
        // Some attribute keys include prefixes and metadata (e.g. "tags[ai.prompt_tokens.used,number]")
        // prettifyAttributeName normalizes those
        acc[prettifyAttributeName(attribute.name)] = attribute.value;
        return acc;
      },
      {} as Record<string, string | number | boolean>
    );
  }

  return attributes;
}

export function getTraceNodeAttribute(
  name: string,
  node: TraceTreeNode<TraceTree.NodeValue>,
  event?: EventTransaction,
  attributes?: TraceItemResponseAttribute[]
) {
  if (!isTransactionNode(node) && !isSpanNode(node) && !isEAPSpanNode(node)) {
    return undefined;
  }

  if (isEAPSpanNode(node) && attributes) {
    const attributeObject = ensureAttributeObject(attributes);
    return attributeObject[name];
  }

  if (isTransactionNode(node) && event) {
    return event.contexts.trace?.data?.[name];
  }

  if (isSpanNode(node)) {
    return node.value.data?.[name];
  }

  return undefined;
}

function createGetIsAiNode(predicate: ({op}: {op?: string}) => boolean) {
  return (node: TraceTreeNode<TraceTree.NodeValue>): node is AITraceSpanNode => {
    if (!isTransactionNode(node) && !isSpanNode(node) && !isEAPSpanNode(node)) {
      return false;
    }

    const op = isTransactionNode(node) ? node.value?.['transaction.op'] : node.value?.op;
    return predicate({op});
  };
}

export const getIsAiNode = createGetIsAiNode(getIsAiSpan);
export const getIsAiRunNode = createGetIsAiNode(getIsAiRunSpan);
