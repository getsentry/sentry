import {Fragment, useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {StructuredData} from 'sentry/components/structuredEventData';
import {IconCopy, IconWarning} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {ModelName} from 'sentry/views/insights/pages/agents/components/modelName';
import {resolveAgentName} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  getIsAiAgentSpan,
  getToolSpansFilter,
} from 'sentry/views/insights/pages/agents/utils/query';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {getTokenBreakdown} from 'sentry/views/insights/pages/agents/utils/tokenBreakdown';
import {SpanFields} from 'sentry/views/insights/types';
import {tryParseJsonRecursive} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

type HighlightedAttribute = {
  name: string;
  value: React.ReactNode;
};

const AI_COST_DOCS_URL =
  'https://docs.sentry.io/ai/monitoring/agents/costs/#troubleshooting';

const LLM_COST_INSTRUCTIONS_MARKDOWN = `
# Fix Sentry AI cost reporting

Sentry can calculate LLM cost when each AI client span records token counts and a model ID.

1. Set \`gen_ai.response.model\` or \`gen_ai.request.model\` to the model ID used for the call.
2. Record token counts on the span:
   - \`gen_ai.usage.input_tokens\`
   - \`gen_ai.usage.output_tokens\`
   - \`gen_ai.usage.total_tokens\`
3. If those values are present and cost is still empty, Sentry may not have pricing data for that model.

Follow Sentry's AI cost troubleshooting guide: ${AI_COST_DOCS_URL}
`;

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
  attributes: Record<string, string> | undefined | TraceItemResponseAttribute[];
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
  attributes: Record<string, string> | TraceItemResponseAttribute[]
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
  attributes = {},
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
  if (isPresentModel(model)) {
    highlightedAttributes.push({
      name: t('Model'),
      value: <ModelName modelId={model.toString()} gap="xs" />,
    });
  } else if (genAiOpType === 'ai_client') {
    highlightedAttributes.push({
      name: t('Model'),
      value: (
        <MissingAIModelCostCallout
          spanId={spanId}
          hasTokenCounts={hasTokenCounts(attributes)}
          hasCost={hasPositiveNumber(attributes['gen_ai.cost.total_tokens'])}
        />
      ),
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

  const totalCosts = attributes['gen_ai.cost.total_tokens'];
  if (totalCosts && Number(totalCosts) > 0) {
    highlightedAttributes.push({
      name: t('Cost'),
      value: <LLMCosts cost={totalCosts.toString()} />,
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

function isPresentModel(value: string | number | boolean | undefined) {
  return Boolean(value) && value?.toString() !== 'null';
}

function hasPositiveNumber(value: string | number | boolean | undefined) {
  return Boolean(value) && Number(value) > 0;
}

function hasTokenCounts(attributes: Record<string, string | number | boolean>) {
  return (
    hasPositiveNumber(attributes['gen_ai.usage.input_tokens']) ||
    hasPositiveNumber(attributes['gen_ai.usage.output_tokens']) ||
    hasPositiveNumber(attributes['gen_ai.usage.total_tokens'])
  );
}

function captureMissingModelCostCalloutMessage({
  action,
  hasCost,
  hasTokenCounts: tokenCountsRecorded,
  spanId,
}: {
  action: 'copy_instructions' | 'docs_click' | 'shown';
  hasCost: boolean;
  hasTokenCounts: boolean;
  spanId: string;
}) {
  Sentry.captureMessage('AI span cost setup callout', {
    level: 'info',
    tags: {
      action,
      feature: 'agent-monitoring',
      has_cost: hasCost ? 'true' : 'false',
      has_token_counts: tokenCountsRecorded ? 'true' : 'false',
      missing_attributes: tokenCountsRecorded
        ? 'gen_ai.response.model'
        : 'gen_ai.response.model,gen_ai.usage.tokens',
      span_id: spanId,
      span_type: 'gen_ai',
    },
  });
}

function MissingAIModelCostCallout({
  hasCost,
  hasTokenCounts: tokenCountsRecorded,
  spanId,
}: {
  hasCost: boolean;
  hasTokenCounts: boolean;
  spanId: string;
}) {
  const organization = useOrganization();
  const didCaptureShown = useRef(false);
  const didTrackHover = useRef(false);

  useEffect(() => {
    if (didCaptureShown.current) {
      return;
    }
    didCaptureShown.current = true;
    captureMissingModelCostCalloutMessage({
      action: 'shown',
      hasCost,
      hasTokenCounts: tokenCountsRecorded,
      spanId,
    });
  }, [hasCost, spanId, tokenCountsRecorded]);

  const analyticsParams = {
    organization,
    hasCost,
    hasTokenCounts: tokenCountsRecorded,
  };

  return (
    <Tooltip
      isHoverable
      title={
        <Stack gap="md" maxWidth="320px">
          <Text as="p" size="sm">
            {t(
              'Sentry needs token counts and a model ID to calculate cost for AI spans.'
            )}
          </Text>
          <Text as="p" size="sm" variant="muted">
            {t(
              'Record gen_ai usage token attributes and gen_ai.response.model or gen_ai.request.model. If those values are present and cost is still empty, Sentry may not have pricing data for this model.'
            )}
          </Text>
          <Flex gap="sm" align="center" wrap="wrap">
            <ExternalLink
              href={AI_COST_DOCS_URL}
              onClick={() => {
                captureMissingModelCostCalloutMessage({
                  action: 'docs_click',
                  hasCost,
                  hasTokenCounts: tokenCountsRecorded,
                  spanId,
                });
                trackAnalytics('agent-monitoring.model-cost-callout-docs-click', {
                  ...analyticsParams,
                });
              }}
            >
              {t('Read the guide')}
            </ExternalLink>
            <Button
              size="xs"
              priority="transparent"
              icon={<IconCopy />}
              onClick={() => {
                copyToClipboard(LLM_COST_INSTRUCTIONS_MARKDOWN, {
                  successMessage: t('Copied LLM instructions to clipboard'),
                });
                captureMissingModelCostCalloutMessage({
                  action: 'copy_instructions',
                  hasCost,
                  hasTokenCounts: tokenCountsRecorded,
                  spanId,
                });
                trackAnalytics('agent-monitoring.model-cost-callout-copy-click', {
                  ...analyticsParams,
                });
              }}
            >
              {t('Copy LLM instructions')}
            </Button>
          </Flex>
        </Stack>
      }
    >
      <Button
        size="xs"
        priority="transparent"
        icon={<IconWarning variant="warning" />}
        onMouseEnter={() => {
          if (didTrackHover.current) {
            return;
          }
          didTrackHover.current = true;
          trackAnalytics('agent-monitoring.model-cost-callout-tooltip-hover', {
            ...analyticsParams,
          });
        }}
      >
        {t('Cost unavailable')}
      </Button>
    </Tooltip>
  );
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
      search: `parent_span:${spanId} has:${SpanFields.GEN_AI_TOOL_NAME} ${getToolSpansFilter()}`,
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
            <Tag key={tool} variant={usedTools.has(tool) ? 'info' : 'muted'}>
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
  const breakdown = getTokenBreakdown({
    inputTokens,
    cachedTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
  });

  const hasCached = breakdown.cached > 0;

  return (
    <Tooltip
      title={
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
      }
    >
      <TokensSpan>
        <Container as="span" display="inline-block">
          <Count value={breakdown.netNewInput} /> {t('in')}
        </Container>
        {hasCached && (
          <Fragment>
            {' '}
            <Container as="span" display="inline-block">
              {' + '}
              <Count value={breakdown.cached} /> {t('cached')}
            </Container>
          </Fragment>
        )}{' '}
        <Container as="span" display="inline-block">
          {' + '}
          <Count value={breakdown.output} /> {t('out')}
        </Container>{' '}
        <Container as="span" display="inline-block">
          {' = '}
          <Count value={breakdown.total} /> {t('total')}
        </Container>
      </TokensSpan>
    </Tooltip>
  );
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

  const inlineValue = (
    <Fragment>
      {percentage}%
      {tokensUsed !== undefined && windowSize !== undefined && (
        <Fragment>
          {' ('}
          <Count value={tokensUsed} />
          {' / '}
          <Count value={windowSize} />
          {')'}
        </Fragment>
      )}
    </Fragment>
  );

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

  return (
    <Tooltip title={tooltipContent}>
      <TokensSpan>{inlineValue}</TokensSpan>
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

const TokensSpan = styled('span')`
  border-bottom: 1px dashed ${p => p.theme.tokens.border.primary};
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
`;
