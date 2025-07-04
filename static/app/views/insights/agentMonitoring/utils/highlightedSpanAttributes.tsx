import Count from 'sentry/components/count';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {LLMCosts} from 'sentry/views/insights/agentMonitoring/components/llmCosts';
import {ModelName} from 'sentry/views/insights/agentMonitoring/components/modelName';
import {hasAgentInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
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

export function getHighlightedSpanAttributes({
  op,
  attributes = {},
  organization,
}: {
  attributes: Record<string, string> | undefined | TraceItemResponseAttribute[];
  op: string | undefined;
  organization: Organization;
}) {
  if (!hasAgentInsightsFeature(organization) || !getIsAiSpan({op})) {
    return [];
  }

  const attributeObject = ensureAttributeObject(attributes);
  const highlightedAttributes = [];

  const model =
    getAttribute(attributeObject, 'gen_ai.request.model') ||
    getAttribute(attributeObject, 'gen_ai.response.model');
  if (model) {
    highlightedAttributes.push({
      name: t('Model'),
      value: <ModelName modelId={model} gap={space(0.5)} />,
    });
  }

  const promptTokens = getAttribute(attributeObject, 'gen_ai.usage.input_tokens');
  const completionTokens = getAttribute(attributeObject, 'gen_ai.usage.output_tokens');
  const totalTokens = getAttribute(attributeObject, 'gen_ai.usage.total_tokens');
  if (promptTokens && completionTokens && totalTokens && Number(totalTokens) > 0) {
    highlightedAttributes.push({
      name: t('Tokens'),
      value: (
        <span>
          <Count value={promptTokens} /> <IconArrow direction="right" size="xs" />{' '}
          <Count value={completionTokens} /> {' (Σ '}
          <Count value={totalTokens} />
          {')'}
        </span>
      ),
    });
  }

  const totalCosts = getAttribute(attributeObject, 'gen_ai.usage.total_cost');
  if (totalCosts && Number(totalCosts) > 0) {
    highlightedAttributes.push({
      name: t('Cost'),
      value: <LLMCosts cost={totalCosts} />,
    });
  }

  const toolName = getAttribute(attributeObject, 'gen_ai.tool.name');
  if (toolName) {
    highlightedAttributes.push({
      name: t('Tool Name'),
      value: toolName,
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
    const attributeObject = ensureAttributeObject(attributes);
    return getAttribute(attributeObject, name);
  }

  if (isTransactionNode(node) && event) {
    return getAttribute(event.contexts.trace?.data || {}, name);
  }

  if (isSpanNode(node)) {
    return getAttribute(node.value.data || {}, name);
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
