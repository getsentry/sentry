import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
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

  const inputTokens = getAIAttribute(attributes, 'gen_ai.usage.input_tokens');
  const cachedTokens = getAIAttribute(attributes, 'gen_ai.usage.cached_tokens');
  const outputTokens = getAIAttribute(attributes, 'gen_ai.usage.output_tokens');
  const reasoningTokens = getAIAttribute(attributes, 'gen_ai.usage.reasoning_tokens');
  const totalTokens = getAIAttribute(attributes, 'gen_ai.usage.total_tokens');

  if (inputTokens && outputTokens && totalTokens && Number(totalTokens) > 0) {
    highlightedAttributes.push({
      name: t('Tokens'),
      value: (
        <HighlightedTokenAttributes
          inputTokens={Number(inputTokens)}
          cachedTokens={Number(cachedTokens)}
          outputTokens={Number(outputTokens)}
          reasoningTokens={Number(reasoningTokens)}
          totalTokens={Number(totalTokens)}
        />
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

function HighlightedTokenAttributes({
  inputTokens,
  cachedTokens,
  outputTokens,
  reasoningTokens,
  totalTokens,
}: {
  cachedTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}) {
  return (
    <Tooltip
      title={
        <TokensTooltipTitle>
          <span>{t('Input')}</span>
          <span>{inputTokens.toString()}</span>
          <SubTextCell>{t('Cached')}</SubTextCell>
          <SubTextCell>{isNaN(cachedTokens) ? '0' : cachedTokens.toString()}</SubTextCell>
          <span>{t('Output')}</span>
          <span>{outputTokens.toString()}</span>
          <SubTextCell>{t('Reasoning')}</SubTextCell>
          <SubTextCell>
            {isNaN(reasoningTokens) ? '0' : reasoningTokens.toString()}
          </SubTextCell>
          <span>{t('Total')}</span>
          <span>{totalTokens.toString()}</span>
        </TokensTooltipTitle>
      }
    >
      <TokensSpan>
        <span>
          <Count value={inputTokens.toString()} /> {t('in')}
        </span>
        <span>+</span>
        <span>
          <Count value={outputTokens.toString()} /> {t('out')}
        </span>
        <span>=</span>
        <span>
          <Count value={totalTokens.toString()} /> {t('total')}
        </span>
      </TokensSpan>
    </Tooltip>
  );
}

const TokensTooltipTitle = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  > *:nth-child(odd) {
    text-align: left;
  }
  > *:nth-child(even) {
    text-align: right;
  }
  gap: ${p => p.theme.space.xs};
`;

const SubTextCell = styled('span')`
  margin-left: ${p => p.theme.space.md};
  color: ${p => p.theme.subText};
`;

const TokensSpan = styled('span')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  border-bottom: 1px dashed ${p => p.theme.border};
`;
