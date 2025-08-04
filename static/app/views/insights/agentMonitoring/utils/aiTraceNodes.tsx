import type {EventTransaction} from 'sentry/types/event';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  getIsAiRunSpan,
  getIsAiSpan,
  legacyAttributeKeys,
} from 'sentry/views/insights/agentMonitoring/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/agentMonitoring/utils/types';
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

/**
 * Get an attribute from the attribute object, checking both the current and legacy keys.
 * @param attributeObject - The attribute object.
 * @param key - The key to check.
 * @returns The attribute value, or undefined if the attribute is not found.
 */
export function getAIAttribute(
  attributeObject: Record<string, string | number | boolean>,
  key: string
) {
  if (attributeObject[key]) {
    return attributeObject[key];
  }
  const legacyKeys = legacyAttributeKeys.get(key) ?? [];
  for (const legacyKey of legacyKeys) {
    if (attributeObject[legacyKey]) {
      return attributeObject[legacyKey];
    }
  }
  return undefined;
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
    return getAIAttribute(attributeObject, name);
  }

  if (isTransactionNode(node) && event) {
    return getAIAttribute(event.contexts.trace?.data || {}, name);
  }

  if (isSpanNode(node)) {
    return getAIAttribute(node.value.data || {}, name);
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
