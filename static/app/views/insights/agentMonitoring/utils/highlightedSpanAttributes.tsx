import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {formatAbbreviatedNumberWithDynamicPrecision} from 'sentry/utils/formatters';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {hasAgentInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import {
  getIsAiSpan,
  legacyAttributeKeys,
} from 'sentry/views/insights/agentMonitoring/utils/query';
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
        acc[prettifyAttributeName(attribute.name)] = attribute.value.toString();
        return acc;
      },
      {} as Record<string, string>
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
function getAttribute(attributeObject: Record<string, string>, key: string) {
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

function formatCost(cost: string) {
  return `US $${formatAbbreviatedNumberWithDynamicPrecision(cost)}`;
}

export function getHighlightedSpanAttributes({
  op,
  description,
  attributes = {},
  organization,
}: {
  attributes: Record<string, string> | undefined | TraceItemResponseAttribute[];
  description: string | undefined;
  op: string | undefined;

  organization: Organization;
}) {
  if (!hasAgentInsightsFeature(organization) || !getIsAiSpan({op, description})) {
    return [];
  }

  const attributeObject = ensureAttributeObject(attributes);
  const highlightedAttributes = [];

  const model = getAttribute(attributeObject, 'gen_ai.request.model');
  if (model) {
    highlightedAttributes.push({
      name: t('Model'),
      value: model,
    });
  }

  const promptTokens = getAttribute(attributeObject, 'gen_ai.usage.input_tokens');
  const completionTokens = getAttribute(attributeObject, 'gen_ai.usage.output_tokens');
  const totalTokens = getAttribute(attributeObject, 'gen_ai.usage.total_tokens');
  if (promptTokens && completionTokens && totalTokens) {
    highlightedAttributes.push({
      name: t('Tokens'),
      value: (
        <span>
          {promptTokens} <IconArrow direction="right" size="xs" />{' '}
          {`${completionTokens} (Σ ${totalTokens})`}
        </span>
      ),
    });
  }

  const totalCosts = getAttribute(attributeObject, 'gen_ai.usage.total_cost');
  if (totalCosts) {
    highlightedAttributes.push({
      name: t('Cost'),
      value: formatCost(totalCosts),
    });
  }

  const toolName = getAttribute(attributeObject, 'ai.toolCall.name');
  if (toolName) {
    highlightedAttributes.push({
      name: t('Tool Name'),
      value: toolName,
    });
  }

  const toolArgs = getAttribute(attributeObject, 'gen_ai.tool.input');
  if (toolArgs) {
    highlightedAttributes.push({
      name: t('Arguments'),
      value: toolArgs,
    });
  }

  const toolResult = getAttribute(attributeObject, 'gen_ai.tool.output');
  if (toolResult) {
    highlightedAttributes.push({
      name: t('Result'),
      value: toolResult,
    });
  }

  return highlightedAttributes;
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
    return attributes.find(attribute => attribute.name === name)?.value;
  }

  if (isTransactionNode(node) && event) {
    return event.contexts.trace?.data?.[name];
  }

  if (isSpanNode(node)) {
    return node.value.data?.[name];
  }

  return undefined;
}

export function getIsAiNode(node: TraceTreeNode<TraceTree.NodeValue>) {
  if (!isTransactionNode(node) && !isSpanNode(node) && !isEAPSpanNode(node)) {
    return undefined;
  }

  if (isTransactionNode(node)) {
    return getIsAiSpan({
      op: node.value['transaction.op'],
      description: node.value.transaction,
    });
  }

  return getIsAiSpan(node.value);
}
