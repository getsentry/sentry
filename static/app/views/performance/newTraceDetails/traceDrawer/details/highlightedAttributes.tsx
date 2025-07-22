import Count from 'sentry/components/count';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {LLMCosts} from 'sentry/views/insights/agentMonitoring/components/llmCosts';
import {ModelName} from 'sentry/views/insights/agentMonitoring/components/modelName';
import {getAIAttribute} from 'sentry/views/insights/agentMonitoring/utils/aiTraceNodes';
import {
  hasAgentInsightsFeature,
  hasMCPInsightsFeature,
} from 'sentry/views/insights/agentMonitoring/utils/features';
import {getIsAiSpan} from 'sentry/views/insights/agentMonitoring/utils/query';

type HighlightedAttribute = {
  name: string;
  value: React.ReactNode;
};

export function getHighlightedSpanAttributes({
  op,
  organization,
  attributes = {},
}: {
  attributes: Record<string, string> | undefined | TraceItemResponseAttribute[];
  op: string | undefined;
  organization: Organization;
}): HighlightedAttribute[] {
  const attributeObject = ensureAttributeObject(attributes);

  if (hasAgentInsightsFeature(organization) && getIsAiSpan({op})) {
    return getAISpanAttributes(attributeObject);
  }

  if (hasMCPInsightsFeature(organization) && op?.startsWith('mcp.')) {
    return getMCPAttributes(attributeObject);
  }

  return [];
}

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

function getAISpanAttributes(attributes: Record<string, string | number | boolean>) {
  const highlightedAttributes = [];

  const model =
    getAIAttribute(attributes, 'gen_ai.request.model') ||
    getAIAttribute(attributes, 'gen_ai.response.model');
  if (model) {
    highlightedAttributes.push({
      name: t('Model'),
      value: <ModelName modelId={model.toString()} gap="xs" />,
    });
  }

  const promptTokens = getAIAttribute(attributes, 'gen_ai.usage.input_tokens');
  const completionTokens = getAIAttribute(attributes, 'gen_ai.usage.output_tokens');
  const totalTokens = getAIAttribute(attributes, 'gen_ai.usage.total_tokens');
  if (promptTokens && completionTokens && totalTokens && Number(totalTokens) > 0) {
    highlightedAttributes.push({
      name: t('Tokens'),
      value: (
        <span>
          <Count value={promptTokens.toString()} />{' '}
          <IconArrow direction="right" size="xs" />{' '}
          <Count value={completionTokens.toString()} /> {' (Σ '}
          <Count value={totalTokens.toString()} />
          {')'}
        </span>
      ),
    });
  }

  const totalCosts = getAIAttribute(attributes, 'gen_ai.usage.total_cost');
  if (totalCosts && Number(totalCosts) > 0) {
    highlightedAttributes.push({
      name: t('Cost'),
      value: <LLMCosts cost={totalCosts.toString()} />,
    });
  }

  const toolName = getAIAttribute(attributes, 'gen_ai.tool.name');
  if (toolName) {
    highlightedAttributes.push({
      name: t('Tool Name'),
      value: toolName,
    });
  }

  return highlightedAttributes;
}

function getMCPAttributes(attributes: Record<string, string | number | boolean>) {
  const highlightedAttributes = [];

  const toolName = attributes['mcp.tool.name'];
  if (toolName) {
    highlightedAttributes.push({
      name: t('Tool Name'),
      value: toolName,
    });
  }

  const resourceUri = attributes['mcp.resource.uri'];
  if (resourceUri) {
    highlightedAttributes.push({
      name: t('Resource URI'),
      value: resourceUri,
    });
  }

  const promptName = attributes['mcp.prompt.name'];
  if (promptName) {
    highlightedAttributes.push({
      name: t('Prompt Name'),
      value: promptName,
    });
  }

  const transport = attributes['mcp.transport'];
  if (transport) {
    highlightedAttributes.push({
      name: t('Transport'),
      value: transport,
    });
  }

  return highlightedAttributes;
}
