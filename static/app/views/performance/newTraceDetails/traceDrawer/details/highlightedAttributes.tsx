import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {StructuredData} from 'sentry/components/structuredEventData';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {LLMCosts} from 'sentry/views/insights/agents/components/llmCosts';
import {ModelName} from 'sentry/views/insights/agents/components/modelName';
import {hasMCPInsightsFeature} from 'sentry/views/insights/agents/utils/features';
import {AI_CREATE_AGENT_OPS, getIsAiSpan} from 'sentry/views/insights/agents/utils/query';

type HighlightedAttribute = {
  name: string;
  value: React.ReactNode;
};

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

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

  if (getIsAiSpan({op})) {
    return getAISpanAttributes(attributeObject, op);
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

function getAISpanAttributes(
  attributes: Record<string, string | number | boolean>,
  op?: string
) {
  const highlightedAttributes = [];

  const agentName = attributes['gen_ai.agent.name'] || attributes['gen_ai.function_id'];
  if (agentName) {
    highlightedAttributes.push({
      name: t('Agent Name'),
      value: agentName,
    });
  }

  const model = attributes['gen_ai.response.model'] || attributes['gen_ai.request.model'];
  if (model) {
    highlightedAttributes.push({
      name: t('Model'),
      value: <ModelName modelId={model.toString()} gap="xs" />,
    });
  }

  const inputTokens = attributes['gen_ai.usage.input_tokens'];
  const cachedTokens = attributes['gen_ai.usage.input_tokens.cached'];
  const outputTokens = attributes['gen_ai.usage.output_tokens'];
  const reasoningTokens = attributes['gen_ai.usage.output_tokens.reasoning'];
  const totalTokens = attributes['gen_ai.usage.total_tokens'];

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

  const totalCosts = attributes['gen_ai.usage.total_cost'];
  if (totalCosts && Number(totalCosts) > 0) {
    highlightedAttributes.push({
      name: t('Cost'),
      value: <LLMCosts cost={totalCosts.toString()} />,
    });
  }

  // Check for missing cost calculation and emit Sentry error
  if (model && (!totalCosts || Number(totalCosts) === 0)) {
    Sentry.captureMessage('Gen AI span missing cost calculation', {
      level: 'warning',
      tags: {
        feature: 'agent-monitoring',
        span_type: 'gen_ai',
        has_model: 'true',
        has_cost: 'false',
        span_operation: op || 'unknown',
        model: model.toString(),
      },
      extra: {
        total_costs: totalCosts,
        span_operation: op,
        attributes,
      },
    });
  }

  const toolName = attributes['gen_ai.tool.name'];
  if (toolName) {
    highlightedAttributes.push({
      name: t('Tool Name'),
      value: toolName,
    });
  }

  const availableTools = attributes['gen_ai.request.available_tools'];
  if (availableTools && AI_CREATE_AGENT_OPS.includes(op!)) {
    highlightedAttributes.push({
      name: t('Available Tools'),
      value: (
        <StructuredData
          value={tryParseJson(availableTools.toString())}
          withAnnotatedText
          maxDefaultDepth={0}
        />
      ),
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
