import type React from 'react';
import {useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {ATTRIBUTE_SEARCH_METADATA} from '@sentry/conventions/attributes/search';
import {IconCalendar} from '@sentry/icons/calendar';
import {IconFix} from '@sentry/icons/fix';
import {IconUser} from '@sentry/icons/user';

import {Tag} from '@sentry/scraps/badge';
import {EntityHeader} from '@sentry/scraps/entityHeader';
import type {EntityHeaderStatProps} from '@sentry/scraps/entityHeader';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {AvatarProject} from 'sentry/types/project';
import {escapeDoubleQuotes} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  ConversationModelUsage,
  ConversationStats,
} from 'sentry/views/explore/conversations/hooks/useConversation';
import {
  getConversationTraceUrl,
  type ConversationTrace,
} from 'sentry/views/explore/conversations/utils/conversationTraceUrl';
import type {
  ConversationUserField,
  ConversationUserIdentity,
} from 'sentry/views/explore/conversations/utils/conversationUser';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {
  LLMCosts,
  NoCostRecordedMessage,
} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {ModelName} from 'sentry/views/insights/pages/agents/components/modelName';
import {
  NegativeCostInfo,
  NegativeCostMessage,
} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';
import {
  CostBreakdownTooltip,
  TokenBreakdownTooltip,
  type TokenBreakdownDetails,
} from 'sentry/views/insights/pages/agents/components/tokenBreakdownTooltip';
import {
  getNumberAttr,
  getStringAttr,
  hasError,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  formatLLMCosts,
  formatLLMCostsExact,
} from 'sentry/views/insights/pages/agents/utils/formatLLMCosts';
import {
  getIsAiGenerationSpan,
  getIsExecuteToolSpan,
} from 'sentry/views/insights/pages/agents/utils/query';
import {getTokenBreakdown} from 'sentry/views/insights/pages/agents/utils/tokenBreakdown';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

interface ConversationSummaryProps {
  conversationId: string;
  nodes: AITraceSpanNode[];
  stats: ConversationStats | null;
  hasMoreSpans?: boolean;
  isLoading?: boolean;
  nodeTraceMap?: Map<string, string>;
  /** Project the conversation belongs to; rendered before the title. */
  project?: AvatarProject;
  /** Conversation title when Sentry has one. */
  title?: string | null;
  user?: ConversationUserIdentity | null;
}

const VISIBLE_TOOL_COUNT = 4;

export function ConversationSummary({
  nodes,
  stats,
  conversationId,
  title,
  project,
  hasMoreSpans,
  isLoading,
  nodeTraceMap,
  user,
}: ConversationSummaryProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const errorCount = stats?.errors ?? 0;
  const erroredToolNames = new Set(stats?.errorToolNames);
  const usageByModel = stats?.usageByModel ?? [];
  const tokenBreakdowns = getTokenBreakdowns(usageByModel);
  const llmCalls = stats?.llmCalls ?? 0;
  const totalTokens = stats?.totalTokens ?? 0;
  // Errored tools lead, so they survive the list's truncation.
  const toolNames = (stats?.toolNames ?? []).toSorted(
    (a, b) =>
      Number(erroredToolNames.has(b)) - Number(erroredToolNames.has(a)) ||
      a.localeCompare(b)
  );
  const startTimestamp = stats?.startTimestamp || null;

  const errorsUrl = getExploreUrl({
    organization,
    selection,
    query: getConversationErrorsQuery(conversationId),
  });

  // Distinct traces the conversation spans, keyed by trace ID with a
  // representative span to deep-link into the trace view. The span's start
  // time lets the trace view find the trace regardless of the page's date range.
  const traces = useMemo(() => {
    if (!nodeTraceMap) {
      return [];
    }
    const startTimestamps = new Map(nodes.map(node => [node.id, node.startTimestamp]));
    const seen = new Map<string, ConversationTrace>();
    for (const [spanId, traceId] of nodeTraceMap) {
      if (!seen.has(traceId)) {
        seen.set(traceId, {traceId, spanId, timestamp: startTimestamps.get(spanId)});
      }
    }
    return Array.from(seen.values());
  }, [nodes, nodeTraceMap]);

  const tracesValue = getTracesValue({
    traces,
    hasMoreSpans,
    singleTraceUrl: trace =>
      getConversationTraceUrl(
        organization.slug,
        trace,
        normalizeDateTimeParams(selection.datetime)
      ),
    allTracesUrl: getExploreUrl({
      organization,
      selection,
      query: `gen_ai.conversation.id:"${escapeDoubleQuotes(conversationId)}"`,
      table: 'trace',
    }),
    onClick: () =>
      trackAnalytics('conversations.detail.click-trace-link', {organization}),
  });

  return (
    <EntityHeader
      isLoading={isLoading}
      title={{
        type: 'text',
        label: t('Conversation'),
        value: title || t('Untitled conversation'),
        leadingGraphic: project
          ? {type: 'project', projects: [project], label: project.slug}
          : undefined,
      }}
      metadata={{
        label: t('Conversation details'),
        items: [
          startTimestamp === null
            ? null
            : {
                type: 'date',
                label: t('Started'),
                date: new Date(startTimestamp),
                leadingGraphic: <IconCalendar size="md" variant="muted" />,
              },
          user
            ? {
                type: 'text',
                label: getUserFieldLabel(user.field),
                value: user.value,
                tooltip: getUserTooltip(user),
                leadingGraphic: <IconUser size="md" variant="muted" />,
              }
            : null,
          toolNames.length > 0
            ? {
                type: 'list',
                label: t('Tools'),
                mode: 'full',
                leadingGraphic: <IconFix size="md" variant="muted" />,
                maxVisible: VISIBLE_TOOL_COUNT,
                items: toolNames.map(name => ({
                  type: 'text',
                  key: name,
                  value: name,
                  variant: erroredToolNames.has(name) ? 'danger' : undefined,
                })),
              }
            : null,
        ],
      }}
      stats={{
        label: t('Conversation stats'),
        items: [
          {
            label: t('LLM Calls'),
            value: {
              type: 'text',
              content: formatAbbreviatedNumber(llmCalls),
              tooltip:
                llmCalls > 0 && usageByModel.length > 0 ? (
                  <ModelMetricBreakdownTooltip
                    breakdowns={usageByModel}
                    metric="llmCalls"
                  />
                ) : undefined,
            },
          },
          {
            label: t('Tokens'),
            value: {
              type: 'text',
              content: formatAbbreviatedNumber(totalTokens),
              tooltip:
                tokenBreakdowns.length > 0 ? (
                  <TokenBreakdownTooltip breakdowns={tokenBreakdowns} />
                ) : undefined,
            },
          },
          {label: t('Cost'), value: getCostValue(stats?.totalCost ?? 0, usageByModel)},
          {label: t('Traces'), value: tracesValue},
          {
            label: t('Errors'),
            value:
              errorCount > 0
                ? {
                    type: 'link',
                    content: formatAbbreviatedNumber(errorCount),
                    to: errorsUrl,
                    onClick: () =>
                      trackAnalytics('conversations.detail.click-errors-link', {
                        organization,
                      }),
                  }
                : 0,
          },
        ],
      }}
    />
  );
}

function getUserFieldLabel(field: ConversationUserField): string {
  switch (field) {
    case 'user.email':
      return t('User email');
    case 'user.username':
      return t('User username');
    case 'user.ip':
      return t('User IP');
    case 'user.id':
      return t('User ID');
    default:
      return unreachable(field);
  }
}

/**
 * Names the field the value came from and, for a scrubbed value, how scrubbing
 * changed it, in one line. Plain text, because nothing in a tooltip can be
 * reached by keyboard.
 */
function getUserTooltip(user: ConversationUserIdentity): string {
  const label = getUserFieldLabel(user.field);
  if (!user.isScrubbed) {
    return label;
  }
  switch (user.scrubbingRule?.remark) {
    case 'm':
      return t('%s masked by data scrubbing.', label);
    case 'p':
      return t('%s pseudonymized by data scrubbing.', label);
    case 'e':
      return t('%s encrypted by data scrubbing.', label);
    default:
      // A "[Filtered]" value with no meta was replaced too.
      return t('%s replaced by data scrubbing.', label);
  }
}

/**
 * A single loaded trace links straight to the trace view; several, or a count
 * that is only a lower bound because more spans are still to load, link to
 * every trace in the conversation.
 */
function getTracesValue({
  traces,
  hasMoreSpans,
  singleTraceUrl,
  allTracesUrl,
  onClick,
}: {
  allTracesUrl: string;
  onClick: () => void;
  singleTraceUrl: (trace: ConversationTrace) => string;
  traces: ConversationTrace[];
  hasMoreSpans?: boolean;
}): EntityHeaderStatProps['value'] {
  const [firstTrace] = traces;
  if (!hasMoreSpans && !firstTrace) {
    return 0;
  }
  if (!hasMoreSpans && firstTrace && traces.length === 1) {
    return {type: 'link', content: 1, to: singleTraceUrl(firstTrace), onClick};
  }
  return {
    type: 'link',
    content: hasMoreSpans ? `${traces.length}+` : traces.length,
    to: allTracesUrl,
    onClick,
  };
}

function getCostValue(
  total: number,
  breakdowns: ConversationModelUsage[]
): EntityHeaderStatProps['value'] {
  if (total < 0) {
    return {
      type: 'text',
      content: formatLLMCosts(total),
      tooltip: <NegativeCostMessage />,
    };
  }
  if (total === 0) {
    return {type: 'text', content: null, tooltip: <NoCostRecordedMessage />};
  }
  return {
    type: 'text',
    content: formatLLMCosts(total),
    tooltip:
      breakdowns.length > 0 ? (
        <CostBreakdownTooltip
          breakdowns={breakdowns.toSorted((a, b) => b.totalCost - a.totalCost)}
        />
      ) : (
        formatLLMCostsExact(total)
      ),
  };
}

interface TraceAggregates {
  errorCount: number;
  llmCalls: number;
  modelBreakdowns: ModelBreakdownDetails[];
  tokenBreakdowns: TokenBreakdownDetails[];
  toolNames: string[];
  totalCost: number;
  totalTokens: number;
}

interface ConversationErrorState {
  errorCount: number;
  erroredToolNames: Set<string>;
}

type ModelBreakdownDetails = Pick<
  ConversationModelUsage,
  'llmCalls' | 'model' | 'totalCost'
>;

function getGenAiOpType(node: AITraceSpanNode): string | undefined {
  return getStringAttr(node, SpanFields.GEN_AI_OPERATION_TYPE);
}

function getConversationErrorState(nodes: AITraceSpanNode[]): ConversationErrorState {
  let errorCount = 0;
  const erroredToolNames = new Set<string>();

  for (const node of nodes) {
    if (!hasError(node)) {
      continue;
    }
    errorCount++;

    if (getIsExecuteToolSpan(getGenAiOpType(node))) {
      const toolName = getStringAttr(node, SpanFields.GEN_AI_TOOL_NAME);
      if (toolName) {
        erroredToolNames.add(toolName);
      }
    }
  }

  return {errorCount, erroredToolNames};
}

function getNumberAttrByConvention(
  node: AITraceSpanNode,
  key: 'gen_ai.usage.cache_creation.input_tokens' | 'gen_ai.usage.cache_read.input_tokens'
): number | undefined {
  for (const candidate of ATTRIBUTE_SEARCH_METADATA[key]?.deprecationChain ?? [key]) {
    const value = getNumberAttr(node, candidate);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function getTokenBreakdowns(
  usageByModel: ConversationModelUsage[]
): TokenBreakdownDetails[] {
  return usageByModel.map(usage => ({
    cacheRead: usage.cacheReadTokens,
    cacheWrite: usage.cacheWriteTokens,
    input: usage.inputTokens,
    isComplete: true,
    output: usage.outputTokens,
    reasoning: usage.reasoningTokens,
    total: usage.totalTokens,
    model: usage.model ?? t('Unknown model'),
  }));
}

function calculateTraceAggregates(nodes: AITraceSpanNode[]): TraceAggregates {
  const {errorCount, erroredToolNames} = getConversationErrorState(nodes);
  let llmCalls = 0;
  let totalCost = 0;
  const metricsByModel = new Map<string, ModelBreakdownDetails>();
  const tokensByModel = new Map<string, TokenBreakdownDetails>();
  const toolNameSet = new Set<string>();

  for (const node of nodes) {
    const opType = getGenAiOpType(node);

    if (getIsAiGenerationSpan(opType)) {
      llmCalls++;
      const cached =
        getNumberAttrByConvention(node, 'gen_ai.usage.cache_read.input_tokens') ?? 0;
      const cacheWrite =
        getNumberAttrByConvention(node, 'gen_ai.usage.cache_creation.input_tokens') ?? 0;
      const input = getNumberAttr(node, SpanFields.GEN_AI_USAGE_INPUT_TOKENS);
      const output = getNumberAttr(node, SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS);
      const reasoning =
        getNumberAttr(node, SpanFields.GEN_AI_USAGE_REASONING_OUTPUT_TOKENS) ?? 0;
      const reportedTotal =
        getNumberAttr(node, SpanFields.GEN_AI_USAGE_TOTAL_TOKENS) ?? 0;
      const breakdown = getTokenBreakdown({
        inputTokens: input ?? 0,
        cachedTokens: cached,
        cacheWriteTokens: cacheWrite,
        outputTokens: output ?? 0,
        reasoningTokens: reasoning,
        totalTokens: reportedTotal,
      });
      const inputTotal = breakdown.netNewInput + breakdown.cached + breakdown.cacheWrite;
      const isComplete = input !== undefined && output !== undefined;

      const model =
        getStringAttr(node, SpanFields.GEN_AI_RESPONSE_MODEL) ||
        getStringAttr(node, SpanFields.GEN_AI_REQUEST_MODEL) ||
        t('Unknown model');
      const cost = getNumberAttr(node, SpanFields.GEN_AI_COST_TOTAL_TOKENS) ?? 0;
      const modelMetrics = metricsByModel.get(model) ?? {
        llmCalls: 0,
        model,
        totalCost: 0,
      };
      modelMetrics.llmCalls++;
      modelMetrics.totalCost += cost;
      metricsByModel.set(model, modelMetrics);
      const modelTokens = tokensByModel.get(model) ?? {
        cacheRead: 0,
        cacheWrite: 0,
        input: 0,
        isComplete: true,
        model,
        output: 0,
        reasoning: 0,
        total: 0,
      };
      modelTokens.input += inputTotal;
      modelTokens.output += breakdown.output;
      modelTokens.cacheRead += breakdown.cached;
      modelTokens.cacheWrite += breakdown.cacheWrite;
      modelTokens.reasoning += reasoning;
      modelTokens.isComplete &&= isComplete;
      modelTokens.total += isComplete ? inputTotal + breakdown.output : reportedTotal;
      tokensByModel.set(model, modelTokens);
      totalCost += cost;
    } else if (getIsExecuteToolSpan(opType)) {
      const toolName = getStringAttr(node, SpanFields.GEN_AI_TOOL_NAME);
      if (toolName) {
        toolNameSet.add(toolName);
      }
    }
  }

  // Errored tools lead, so they survive the row's truncation.
  const toolNames = Array.from(toolNameSet).sort(
    (a, b) =>
      Number(erroredToolNames.has(b)) - Number(erroredToolNames.has(a)) ||
      a.localeCompare(b)
  );
  const tokenBreakdowns = Array.from(tokensByModel.values()).sort(
    (a, b) => b.total - a.total
  );

  return {
    llmCalls,
    errorCount,
    modelBreakdowns: Array.from(metricsByModel.values()),
    tokenBreakdowns,
    totalTokens: tokenBreakdowns.reduce((total, breakdown) => total + breakdown.total, 0),
    totalCost,
    toolNames,
  };
}

const AGGREGATES_BAR_VISIBLE_TOOL_COUNT = 4;

function getConversationErrorsQuery(conversationId: string): string {
  return `gen_ai.conversation.id:"${escapeDoubleQuotes(conversationId)}" has:span.status !span.status:[ok,cancelled,unknown]`;
}

/**
 * Aggregate metrics row for a conversation (LLM Calls, Errors, Tokens, Cost, Tools).
 * Used standalone in the trace AI tab.
 */
export function ConversationAggregatesBar({
  nodes,
  conversationId,
  isLoading,
}: {
  conversationId: string;
  nodes: AITraceSpanNode[];
  isLoading?: boolean;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const aggregates = useMemo(() => calculateTraceAggregates(nodes), [nodes]);

  const errorsUrl = getExploreUrl({
    organization,
    selection,
    query: getConversationErrorsQuery(conversationId),
  });

  // minHeight matches the tool Tag height so the row stays the same height whether or not tools render
  return (
    <Flex align="center" gap="lg" minWidth={0} minHeight="20px">
      <AggregateItem
        label={t('LLM Calls')}
        value={
          <ModelMetricBreakdown
            breakdowns={aggregates.modelBreakdowns}
            metric="llmCalls"
            total={aggregates.llmCalls}
          />
        }
        isLoading={isLoading}
      />
      <AggregateItem
        label={t('Errors')}
        value={<Count value={aggregates.errorCount} />}
        to={aggregates.errorCount > 0 ? errorsUrl : undefined}
        isLoading={isLoading}
      />
      <AggregateItem
        label={t('Tokens')}
        value={
          <TokenCount
            breakdowns={aggregates.tokenBreakdowns}
            total={aggregates.totalTokens}
          />
        }
        isLoading={isLoading}
      />
      <AggregateItem
        label={t('Cost')}
        value={
          aggregates.totalCost < 0 ? (
            <NegativeCostInfo cost={aggregates.totalCost} />
          ) : (
            <ModelMetricBreakdown
              breakdowns={aggregates.modelBreakdowns}
              metric="totalCost"
              total={aggregates.totalCost}
            />
          )
        }
        isLoading={isLoading}
      />
      {isLoading ? (
        <Flex align="center" gap="xs" flexShrink={0}>
          <Text size="sm" bold variant="muted">
            {t('Used Tools')}
          </Text>
          <Placeholder width="60px" height="14px" />
        </Flex>
      ) : (
        aggregates.toolNames.length > 0 && (
          <ToolTagsRow>
            <Text size="sm" bold variant="muted" wrap="nowrap">
              {t('Used Tools')}
            </Text>
            {aggregates.toolNames
              .slice(0, AGGREGATES_BAR_VISIBLE_TOOL_COUNT)
              .map(name => (
                <Tag key={name} variant="info">
                  {name}
                </Tag>
              ))}
            {aggregates.toolNames.length > AGGREGATES_BAR_VISIBLE_TOOL_COUNT && (
              <InfoText
                size="sm"
                variant="muted"
                wrap="nowrap"
                title={
                  <Flex wrap="wrap" gap="xs" paddingTop="xs" paddingBottom="xs">
                    {aggregates.toolNames
                      .slice(AGGREGATES_BAR_VISIBLE_TOOL_COUNT)
                      .map(name => (
                        <Tag key={name} variant="info">
                          {name}
                        </Tag>
                      ))}
                  </Flex>
                }
              >
                {t(
                  '+%s more',
                  aggregates.toolNames.length - AGGREGATES_BAR_VISIBLE_TOOL_COUNT
                )}
              </InfoText>
            )}
          </ToolTagsRow>
        )
      )}
    </Flex>
  );
}

type ModelBreakdownMetric = 'llmCalls' | 'totalCost';

function formatModelMetric(metric: ModelBreakdownMetric, value: number) {
  return metric === 'llmCalls' ? formatAbbreviatedNumber(value) : formatLLMCosts(value);
}

function ModelMetricBreakdownTooltip({
  breakdowns,
  metric,
}: {
  breakdowns: ModelBreakdownDetails[];
  metric: ModelBreakdownMetric;
}) {
  const sortedBreakdowns = breakdowns.toSorted((a, b) => b[metric] - a[metric]);

  return (
    <Stack gap="sm" width="100%">
      {sortedBreakdowns.map(breakdown => (
        <Flex key={breakdown.model} align="center" gap="xl" width="100%">
          <Container minWidth={0} flex={1} overflow="hidden">
            <ModelName
              modelId={breakdown.model ?? t('Unknown model')}
              size={14}
              gap="sm"
            />
          </Container>
          <Container flexShrink={0}>
            <Text tabular align="right">
              {formatModelMetric(metric, breakdown[metric])}
            </Text>
          </Container>
        </Flex>
      ))}
    </Stack>
  );
}

function ModelMetricBreakdown({
  breakdowns,
  metric,
  total,
}: {
  breakdowns: ModelBreakdownDetails[];
  metric: ModelBreakdownMetric;
  total: number;
}) {
  if (total === 0 || breakdowns.length === 0) {
    return metric === 'llmCalls' ? <Count value={total} /> : <LLMCosts cost={total} />;
  }

  return (
    <Tooltip
      title={<ModelMetricBreakdownTooltip breakdowns={breakdowns} metric={metric} />}
    >
      <BreakdownValue>{formatModelMetric(metric, total)}</BreakdownValue>
    </Tooltip>
  );
}

function TokenCount({
  breakdowns,
  total,
}: {
  breakdowns: TokenBreakdownDetails[];
  total: number;
}) {
  const value = formatAbbreviatedNumber(total);
  if (breakdowns.length === 0) {
    return value;
  }

  return (
    <Tooltip title={<TokenBreakdownTooltip breakdowns={breakdowns} />}>
      <BreakdownValue>{value}</BreakdownValue>
    </Tooltip>
  );
}

function AggregateItem({
  label,
  value,
  to,
  isLoading,
}: {
  label: string;
  value: React.ReactNode;
  isLoading?: boolean;
  to?: string;
}) {
  const isInteractive = !!to && !isLoading;

  const content = (
    <Flex align="center" gap="xs" flexShrink={0}>
      <Text size="sm" variant="muted">
        {label}
      </Text>
      {isLoading ? (
        <Placeholder width="28px" height="14px" />
      ) : (
        <AggregateValue size="sm" bold isInteractive={isInteractive}>
          {value}
        </AggregateValue>
      )}
    </Flex>
  );

  if (isInteractive) {
    return <StyledLink to={to}>{content}</StyledLink>;
  }

  return content;
}

const BreakdownValue = styled('span')`
  text-decoration: underline dotted;
  text-underline-offset: ${p => p.theme.space['2xs']};
`;

const AggregateValue = styled(Text)<{isInteractive?: boolean}>`
  ${p =>
    p.isInteractive &&
    css`
      color: ${p.theme.tokens.interactive.link.accent.rest};
    `}
`;

const StyledLink = styled(Link)`
  text-decoration: none;
`;

function ToolTagsRow({children}: {children: React.ReactNode}) {
  return (
    <Flex
      align="center"
      gap="xs"
      minWidth={0}
      overflow="hidden"
      flexShrink={1}
      wrap="nowrap"
    >
      {children}
    </Flex>
  );
}
