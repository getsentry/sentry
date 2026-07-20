import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Tag} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ExternalLink} from 'sentry/components/links/externalLink';
import {StructuredData} from 'sentry/components/structuredEventData';
import {t, tct, tn} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {ModelName} from 'sentry/views/insights/pages/agents/components/modelName';
import {
  NegativeCostInfo,
  TOKEN_TROUBLESHOOTING_URL,
} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';
import {resolveAgentName} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  getIsAiAgentSpan,
  getToolSpansFilter,
} from 'sentry/views/insights/pages/agents/utils/query';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {
  getTokenBreakdown,
  hasTokenMismatch,
} from 'sentry/views/insights/pages/agents/utils/tokenBreakdown';
import {SpanFields} from 'sentry/views/insights/types';
import {tryParseJsonRecursive} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

type HighlightedAttribute = {
  name: string;
  value: React.ReactNode;
};

/**
 * Gets AI tool definitions, checking attributes in priority order.
 * Priority: gen_ai.tool.definitions > gen_ai.request.available_tools
 */
function getAIToolDefinitions(
  attributes: Record<string, string | number | boolean>
): any[] | null {
  const toolDefinitions = attributes['gen_ai.tool.definitions'];
  if (toolDefinitions) {
    const parsed = tryParseJsonRecursive(toolDefinitions.toString());
    if (Array.isArray(parsed)) {
      return parsed;
    }
  }

  const availableTools = attributes['gen_ai.request.available_tools'];
  if (availableTools) {
    const parsed = tryParseJsonRecursive(availableTools.toString());
    if (Array.isArray(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function getHighlightedSpanAttributes({
  op,
  spanId,
  attributes = {},
}: {
  attributes:
    | Record<string, string | number | boolean>
    | undefined
    | TraceItemResponseAttribute[];
  spanId: string;
  op?: string;
}): HighlightedAttribute[] {
  const attributeObject = ensureAttributeObject(attributes);
  const genAiOpType = attributeObject['gen_ai.operation.type'] as string | undefined;

  if (genAiOpType) {
    return getAISpanAttributes({attributes: attributeObject, spanId});
  }

  if (op?.startsWith('mcp.')) {
    return getMCPAttributes(attributeObject);
  }

  return [];
}

function ensureAttributeObject(
  attributes: Record<string, string | number | boolean> | TraceItemResponseAttribute[]
) {
  if (Array.isArray(attributes)) {
    return attributes.reduce<Record<string, string | number | boolean>>(
      (acc, attribute) => {
        // Some attribute keys include prefixes and metadata (e.g. "tags[ai.prompt_tokens.used,number]")
        // prettifyAttributeName normalizes those
        acc[prettifyAttributeName(attribute.name)] = attribute.value;
        return acc;
      },
      {}
    );
  }

  return attributes;
}

function getAISpanAttributes({
  spanId,
  attributes,
}: {
  attributes: Record<string, string | number | boolean>;
  spanId: string;
}) {
  const highlightedAttributes = [];

  const genAiOpType = attributes['gen_ai.operation.type'] as string | undefined;

  const agentName = resolveAgentName(attributes);
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

  const reasoningLevel = attributes[SpanFields.GEN_AI_REQUEST_REASONING_LEVEL];
  if (reasoningLevel) {
    highlightedAttributes.push({
      name: t('Reasoning Level'),
      value: reasoningLevel.toString(),
    });
  }

  const inputTokens = attributes['gen_ai.usage.input_tokens'];
  const cachedTokens =
    attributes['gen_ai.usage.cache_read.input_tokens'] ??
    attributes['gen_ai.usage.input_tokens.cached'];
  const outputTokens = attributes['gen_ai.usage.output_tokens'];
  const reasoningTokens =
    attributes['gen_ai.usage.reasoning.output_tokens'] ??
    attributes['gen_ai.usage.output_tokens.reasoning'];
  const totalTokens = attributes['gen_ai.usage.total_tokens'];

  if (inputTokens && outputTokens && totalTokens && Number(totalTokens) !== 0) {
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

  const totalCosts = attributes['gen_ai.cost.total_tokens'];
  if (totalCosts && Number(totalCosts) !== 0) {
    const costValue = Number(totalCosts);
    highlightedAttributes.push({
      name: t('Cost'),
      value:
        costValue < 0 ? (
          <NegativeCostInfo cost={totalCosts.toString()} />
        ) : (
          <LLMCosts cost={totalCosts.toString()} />
        ),
    });
  }

  const contextUtilization = attributes[SpanFields.GEN_AI_CONTEXT_UTILIZATION];
  if (contextUtilization && Number(contextUtilization) > 0) {
    const windowSize = attributes[SpanFields.GEN_AI_CONTEXT_WINDOW_SIZE];
    highlightedAttributes.push({
      name: t('Context Utilization'),
      value: (
        <HighlightedContextUtilization
          utilization={Number(contextUtilization)}
          windowSize={windowSize ? Number(windowSize) : undefined}
          totalTokens={totalTokens ? Number(totalTokens) : undefined}
        />
      ),
    });
  }

  const toolName = attributes['gen_ai.tool.name'];
  if (toolName) {
    highlightedAttributes.push({
      name: t('Tool Name'),
      value: toolName,
    });
  }

  const toolsArray = getAIToolDefinitions(attributes);
  if (toolsArray && toolsArray.length > 0 && getIsAiAgentSpan(genAiOpType)) {
    highlightedAttributes.push({
      name: t('Available Tools'),
      value: <HighlightedTools availableTools={toolsArray} spanId={spanId} />,
    });
  }

  // Emit a message if the span is missing any required gen_ai attributes,
  // but only if the origin starts with "auto.ai"
  const requiredGenAIAttributes = [
    'gen_ai.system',
    'gen_ai.request.model',
    'gen_ai.operation.name',
    'gen_ai.agent.name',
  ];

  const missingGenAIAttributes = requiredGenAIAttributes.filter(
    attr => !attributes[attr]
  );

  const origin = attributes['gen_ai.origin'];
  if (
    missingGenAIAttributes.length > 0 &&
    typeof origin === 'string' &&
    origin.startsWith('auto.ai')
  ) {
    const sdkName = attributes['sdk.name'];
    const sdkVersion = attributes['sdk.version'];

    Sentry.captureMessage('Gen AI span missing required attributes', {
      level: 'warning',
      tags: {
        feature: 'agent-monitoring',
        span_type: 'gen_ai',
        missing_attributes: missingGenAIAttributes.join(','),
        origin,
        sdk:
          [sdkName?.toString(), sdkVersion?.toString()].filter(Boolean).join('@') ||
          'unknown',
        span_id: spanId,
      },
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

function HighlightedTools({
  availableTools,
  spanId,
}: {
  availableTools: any[];
  spanId: string;
}) {
  const toolNames = availableTools.map(tool => tool.name).filter(Boolean);
  const hasToolNames = toolNames.length > 0;
  const toolSpansQuery = useSpans(
    {
      search: `parent_span:${spanId} has:${
        SpanFields.GEN_AI_TOOL_NAME
      } ${getToolSpansFilter()}`,
      fields: [SpanFields.GEN_AI_TOOL_NAME],
      enabled: hasToolNames,
    },
    Referrer.TRACE_DRAWER_TOOL_USAGE
  );

  const usedTools = new Map<string, number>();
  toolSpansQuery.data?.forEach(span => {
    const toolName = span[SpanFields.GEN_AI_TOOL_NAME];
    usedTools.set(toolName, (usedTools.get(toolName) ?? 0) + 1);
  });

  // Fall back to showing formatted JSON if tool names cannot be parsed
  if (!hasToolNames) {
    return (
      <StructuredData value={availableTools} withAnnotatedText maxDefaultDepth={0} />
    );
  }

  return (
    <Flex direction="row" gap="xs" wrap="wrap">
      {toolNames.sort().map(tool => {
        const usageCount = usedTools.get(tool) ?? 0;
        return (
          <Tooltip
            key={tool}
            disabled={toolSpansQuery.isPending}
            title={
              usageCount === 0
                ? t('Not used by agent')
                : tn('Used %s time', 'Used %s times', usageCount)
            }
          >
            <Tag
              key={tool}
              variant={usedTools.has(tool) ? 'info' : 'muted'}
              css={truncatedTagCss}
            >
              {tool}
            </Tag>
          </Tooltip>
        );
      })}
    </Flex>
  );
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
  const tokenArgs = {
    inputTokens,
    cachedTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
  };
  const breakdown = getTokenBreakdown(tokenArgs);
  const mismatch = hasTokenMismatch(tokenArgs);

  const hasCached = breakdown.cached > 0;

  const abbr = formatAbbreviatedNumber;
  const tokenSummary = `${abbr(breakdown.netNewInput)} ${t('in')}${hasCached ? ` + ${abbr(breakdown.cached)} ${t('cached')}` : ''} + ${abbr(breakdown.output)} ${t('out')} = ${abbr(breakdown.total)} ${t('total')}`;

  const breakdownTooltip = (
    <TokensTooltipTitle>
      <span>{t('Input')}</span>
      <span>{breakdown.netNewInput.toLocaleString()}</span>
      {hasCached && (
        <Fragment>
          <span>{t('Cached')}</span>
          <span>{breakdown.cached.toLocaleString()}</span>
        </Fragment>
      )}
      <span>{t('Output')}</span>
      <span>{breakdown.output.toLocaleString()}</span>
      <span>{t('Total')}</span>
      <span>{breakdown.total.toLocaleString()}</span>
    </TokensTooltipTitle>
  );

  if (mismatch) {
    return (
      <InfoText
        variant="warning"
        title={tct(
          'Input and output token counts do not add up to the reported total. This may indicate an error in token reporting. [link:Learn more].',
          {link: <ExternalLink href={TOKEN_TROUBLESHOOTING_URL} />}
        )}
      >
        {tokenSummary}
      </InfoText>
    );
  }

  return <InfoText title={breakdownTooltip}>{tokenSummary}</InfoText>;
}

function HighlightedContextUtilization({
  utilization,
  totalTokens,
  windowSize,
}: {
  utilization: number;
  totalTokens?: number;
  windowSize?: number;
}) {
  const percentage = Math.round(utilization * 100);
  const tokensUsed =
    windowSize === undefined ? totalTokens : Math.round(utilization * windowSize);

  const inlineText =
    tokensUsed !== undefined && windowSize !== undefined
      ? `${percentage}% (${formatAbbreviatedNumber(tokensUsed)} / ${formatAbbreviatedNumber(windowSize)})`
      : `${percentage}%`;

  const tooltipContent = (
    <TokensTooltipTitle>
      {windowSize !== undefined && (
        <Fragment>
          <span>{t('Window Size')}</span>
          <span>{windowSize.toLocaleString()}</span>
        </Fragment>
      )}
      {tokensUsed !== undefined && (
        <Fragment>
          <span>{t('Tokens Used')}</span>
          <span>{tokensUsed.toLocaleString()}</span>
        </Fragment>
      )}
      <span>{t('Utilization')}</span>
      <span>{percentage}%</span>
    </TokensTooltipTitle>
  );

  return <InfoText title={tooltipContent}>{inlineText}</InfoText>;
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

const truncatedTagCss = css`
  min-width: 0;
  max-width: 100%;

  & > * {
    display: block;
  }
`;
