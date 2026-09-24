import type React from 'react';
import {Fragment, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {ATTRIBUTE_SEARCH_METADATA} from '@sentry/conventions/attributes/search';

import {Tag} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {DateTime} from 'sentry/components/dateTime';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Placeholder} from 'sentry/components/placeholder';
import {TimeSince} from 'sentry/components/timeSince';
import {IconCalendar, IconFire, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {AvatarProject} from 'sentry/types/project';
import {escapeDoubleQuotes} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {isUUID} from 'sentry/utils/string/isUUID';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getUserDisplayName,
  normalizeUserField,
  UserNotInstrumentedTooltip,
} from 'sentry/views/explore/conversations/components/conversationsTable';
import {ConversationTraceLink} from 'sentry/views/explore/conversations/components/conversationTraceLink';
import {ToolTag} from 'sentry/views/explore/conversations/components/toolTag';
import type {
  ConversationStats as ConversationApiStats,
  ConversationModelUsage,
} from 'sentry/views/explore/conversations/hooks/useConversation';
import type {ConversationUser} from 'sentry/views/explore/conversations/hooks/useConversations';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {NegativeCostInfo} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';
import {
  TokenBreakdownTooltip,
  type TokenBreakdownDetails,
} from 'sentry/views/insights/pages/agents/components/tokenBreakdownTooltip';
import {
  getNumberAttr,
  getStringAttr,
  hasError,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
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
  stats: ConversationApiStats | null;
  isLoading?: boolean;
  nodeTraceMap?: Map<string, string>;
  /** Project the conversation belongs to; rendered beneath the title. */
  project?: AvatarProject;
  /** Conversation title when Sentry has one; falls back to the id when null. */
  title?: string | null;
}

const VISIBLE_TOOL_COUNT = 6;

// Rendered heights of the content the loading skeletons stand in for. Text trims
// to its font's ascender and descender, so those values are the trimmed boxes
// rather than the line heights.
const TEXT_XL_HEIGHT = '23px'; // `Text size="xl"`, and `Heading as="h2"` with it
const TEXT_MD_HEIGHT = '16px'; // the `ProjectBadge` name, at the body font size
const TEXT_SM_HEIGHT = '14px';
const TAG_HEIGHT = '20px'; // `Tag`, and `ToolTag` with it
// The zero-size dropdown button the trace link renders for several traces.
const TRACE_LINK_HEIGHT = '24px';

export function ConversationSummary({
  stats,
  nodes,
  conversationId,
  title,
  project,
  isLoading,
  nodeTraceMap,
}: ConversationSummaryProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const calculatedAggregates = useMemo(() => calculateAggregates(nodes), [nodes]);
  const aggregateValues = stats ?? calculatedAggregates;
  const tokenBreakdowns = stats
    ? getTokenBreakdowns(stats.usageByModel)
    : calculatedAggregates.tokenBreakdowns;
  const toolNames = orderToolNames(
    aggregateValues.toolNames,
    calculatedAggregates.erroredToolNames
  );
  const user = useMemo(() => getConversationUser(nodes), [nodes]);
  const userDisplayName = user ? getUserDisplayName(user) : null;

  const displayId = isUUID(conversationId) ? conversationId.slice(0, 8) : conversationId;
  // Prefer the human-readable title; fall back to the (possibly truncated) id.
  const headingText = title || displayId;
  const headingTooltip = title || conversationId;
  // A UUID id is truncated to 8 chars, so it always needs the tooltip to reveal
  // the full value; a title or non-UUID id only needs it when it overflows.
  const headingTooltipOnlyOnOverflow = title ? true : !isUUID(conversationId);

  const errorsUrl = getExploreUrl({
    organization,
    selection,
    query: `gen_ai.conversation.id:"${escapeDoubleQuotes(
      conversationId
    )}" span.status:[internal_error,error]`,
  });

  // Distinct traces the conversation spans, keyed by trace ID with a
  // representative span ID to deep-link into the trace view.
  const traces = useMemo(() => {
    if (!nodeTraceMap) {
      return [];
    }
    const seen = new Map<string, string>();
    for (const [spanId, traceId] of nodeTraceMap) {
      if (!seen.has(traceId)) {
        seen.set(traceId, spanId);
      }
    }
    return Array.from(seen, ([traceId, spanId]) => ({traceId, spanId}));
  }, [nodeTraceMap]);

  return (
    <Flex
      direction={{zero: 'column', xl: 'row'}}
      justify="between"
      align={{zero: 'stretch', xl: 'center'}}
      gap="xl"
      flex={1}
      minWidth={0}
    >
      <Stack gap="md" minWidth={0} flex={1}>
        {/* A flex box rather than a block: Tooltip wraps the heading in an
            inline-block span, and as a block this would size to a line box,
            adding the font strut's descender under the heading. */}
        <Container minWidth={0} display="flex">
          {isLoading ? (
            // The title is only known once the conversation loads, so show a
            // skeleton rather than briefly flashing the id and swapping it out.
            <Placeholder width="240px" height={TEXT_XL_HEIGHT} />
          ) : (
            <Tooltip
              title={headingTooltip}
              showOnlyOnOverflow={headingTooltipOnlyOnOverflow}
            >
              <Heading as="h2" ellipsis>
                {headingText}
              </Heading>
            </Tooltip>
          )}
        </Container>
        {isLoading ? (
          <Fragment>
            <Flex align="center" gap="sm" minWidth={0} wrap="wrap">
              <Placeholder width="40px" height={TEXT_SM_HEIGHT} />
              <Placeholder width="72px" height={TAG_HEIGHT} />
              <Placeholder width="72px" height={TAG_HEIGHT} />
            </Flex>
            <MetaRow>
              <Flex align="center" gap="xs">
                <Placeholder width="16px" height="16px" />
                <Placeholder width="140px" height={TEXT_SM_HEIGHT} />
              </Flex>
              <Flex align="center" gap="xs">
                <Placeholder width="12px" height="12px" />
                <Placeholder width="40px" height={TEXT_SM_HEIGHT} />
              </Flex>
              {/* The project comes from the conversation's spans, so it is only
                  known once they load; its space is reserved either way. */}
              <Flex align="center" gap="sm">
                <Placeholder width="16px" height="16px" />
                <Placeholder width="80px" height={TEXT_MD_HEIGHT} />
              </Flex>
              <Flex align="center" gap="xs">
                <Placeholder width="16px" height="16px" />
                <Placeholder width="120px" height={TEXT_SM_HEIGHT} />
              </Flex>
            </MetaRow>
          </Fragment>
        ) : (
          <Fragment>
            {toolNames.length > 0 && (
              <Flex align="center" gap="sm" minWidth={0} wrap="wrap">
                <Text size="sm" wrap="nowrap">
                  {t('Tools:')}
                </Text>
                {toolNames.slice(0, VISIBLE_TOOL_COUNT).map(name => (
                  <ToolTag
                    key={name}
                    name={name}
                    hasError={calculatedAggregates.erroredToolNames.has(name)}
                  />
                ))}
                {toolNames.length > VISIBLE_TOOL_COUNT && (
                  <InfoText
                    size="sm"
                    variant="muted"
                    wrap="nowrap"
                    title={
                      <Flex wrap="wrap" gap="sm" paddingTop="xs" paddingBottom="xs">
                        {toolNames.slice(VISIBLE_TOOL_COUNT).map(name => (
                          <ToolTag
                            key={name}
                            name={name}
                            hasError={calculatedAggregates.erroredToolNames.has(name)}
                          />
                        ))}
                      </Flex>
                    }
                  >
                    {t('+%s more', toolNames.length - VISIBLE_TOOL_COUNT)}
                  </InfoText>
                )}
              </Flex>
            )}
            <MetaRow>
              {aggregateValues.startTimestamp > 0 && (
                <Flex align="center" gap="xs">
                  <IconCalendar size="md" />
                  <InfoText
                    size="sm"
                    title={
                      <TimeSince
                        date={aggregateValues.startTimestamp}
                        disabledAbsoluteTooltip
                      />
                    }
                  >
                    <DateTime date={aggregateValues.startTimestamp} year timeZone />
                  </InfoText>
                </Flex>
              )}
              <ConversationTraceLink conversationId={conversationId} traces={traces} />
              {project && <ProjectBadge project={project} avatarSize={16} disableLink />}
              <Flex align="center" gap="xs" minWidth={0}>
                <IconUser size="md" />
                {userDisplayName ? (
                  <InfoText
                    title={userDisplayName}
                    mode="overflowOnly"
                    size="sm"
                    variant="muted"
                  >
                    {userDisplayName}
                  </InfoText>
                ) : (
                  <InfoText
                    size="sm"
                    variant="muted"
                    title={<UserNotInstrumentedTooltip />}
                  >
                    &mdash;
                  </InfoText>
                )}
              </Flex>
            </MetaRow>
          </Fragment>
        )}
      </Stack>
      <Flex align="start" gap="xl" wrap="wrap" flexShrink={0}>
        <Stat
          label={t('LLM Calls')}
          value={<Count value={aggregateValues.llmCalls} />}
          isLoading={isLoading}
        />
        <Stat
          label={t('Errors')}
          value={<Count value={calculatedAggregates.errors} />}
          icon={
            calculatedAggregates.errors > 0 ? (
              <IconFire
                size="sm"
                variant="danger"
                data-test-id="conversation-error-icon"
              />
            ) : undefined
          }
          to={calculatedAggregates.errors > 0 ? errorsUrl : undefined}
          onClick={
            calculatedAggregates.errors > 0
              ? () =>
                  trackAnalytics('conversations.detail.click-errors-link', {
                    organization,
                  })
              : undefined
          }
          isLoading={isLoading}
        />
        <Stat
          label={t('Tokens')}
          value={
            <TokenCount
              breakdowns={tokenBreakdowns}
              total={aggregateValues.totalTokens}
            />
          }
          isLoading={isLoading}
        />
        <Stat
          label={t('Cost')}
          value={
            <CostCount breakdowns={tokenBreakdowns} total={aggregateValues.totalCost} />
          }
          isLoading={isLoading}
        />
      </Flex>
    </Flex>
  );
}

/**
 * The row of conversation metadata under the title. Its minHeight matches the
 * trace link's dropdown button, the tallest thing it holds, so the row keeps
 * its height whether the link renders as a button, a plain link, or a skeleton.
 */
function MetaRow({children}: {children: React.ReactNode}) {
  return (
    <Flex align="center" gap="xl" minWidth={0} wrap="wrap" minHeight={TRACE_LINK_HEIGHT}>
      {children}
    </Flex>
  );
}

function Stat({
  label,
  value,
  isLoading,
  to,
  onClick,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  isLoading?: boolean;
  onClick?: () => void;
  to?: string;
}) {
  const isInteractive = !!to && !isLoading;

  const valueContent = (
    <Flex align="center" gap="xs">
      <Text
        size="xl"
        tabular
        variant={isInteractive ? 'danger' : undefined}
        wrap="nowrap"
      >
        {value}
      </Text>
      {icon}
    </Flex>
  );

  return (
    <Stack gap="xs" flexShrink={0}>
      <Text size="sm" variant="muted" bold wrap="nowrap">
        {label}
      </Text>
      {isLoading ? (
        <Placeholder width="32px" height={TEXT_XL_HEIGHT} />
      ) : isInteractive ? (
        <Link to={to} onClick={onClick}>
          {valueContent}
        </Link>
      ) : (
        valueContent
      )}
    </Stack>
  );
}

interface CalculatedConversationAggregates {
  erroredToolNames: Set<string>;
  errors: number;
  llmCalls: number;
  /** When the conversation began, or zero when no span carries a start time. */
  startTimestamp: number;
  tokenBreakdowns: TokenBreakdownDetails[];
  toolCalls: number;
  toolNames: string[];
  totalCost: number;
  totalTokens: number;
}

function getGenAiOpType(node: AITraceSpanNode): string | undefined {
  return getStringAttr(node, SpanFields.GEN_AI_OPERATION_TYPE);
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

function orderToolNames(
  toolNames: string[],
  erroredToolNames: ReadonlySet<string>
): string[] {
  return [
    ...toolNames.filter(name => erroredToolNames.has(name)),
    ...toolNames.filter(name => !erroredToolNames.has(name)),
  ];
}

function getTokenBreakdowns(
  usageByModel: ConversationModelUsage[]
): TokenBreakdownDetails[] {
  return usageByModel.map(usage => {
    const isComplete = usage.inputTokens !== null && usage.outputTokens !== null;
    const breakdown = getTokenBreakdown({
      inputTokens: usage.inputTokens ?? 0,
      cachedTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      outputTokens: usage.outputTokens ?? 0,
      reasoningTokens: usage.reasoningTokens,
      totalTokens: usage.totalTokens,
    });
    const input = breakdown.netNewInput + breakdown.cached + breakdown.cacheWrite;

    return {
      cacheRead: breakdown.cached,
      cacheWrite: breakdown.cacheWrite,
      input,
      isComplete,
      output: breakdown.output,
      reasoning: usage.reasoningTokens,
      total: isComplete ? input + breakdown.output : usage.totalTokens,
      inputCost: usage.inputCost,
      model: usage.model ?? t('Unknown model'),
      outputCost: usage.outputCost,
      totalCost: usage.totalCost,
    };
  });
}

function calculateAggregates(nodes: AITraceSpanNode[]): CalculatedConversationAggregates {
  let llmCalls = 0;
  let toolCalls = 0;
  let errors = 0;
  let totalCost = 0;
  const tokensByModel = new Map<string, TokenBreakdownDetails>();
  let startTimestamp = 0;
  const toolNameSet = new Set<string>();
  const erroredToolNameSet = new Set<string>();

  for (const node of nodes) {
    const opType = getGenAiOpType(node);
    const nodeHasError = hasError(node);

    // Nodes without a timestamp leave space at its [0, 0] default.
    const [nodeStart] = node.space;
    if (nodeStart > 0 && (startTimestamp === 0 || nodeStart < startTimestamp)) {
      startTimestamp = nodeStart;
    }

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
      totalCost += getNumberAttr(node, SpanFields.GEN_AI_COST_TOTAL_TOKENS) ?? 0;
    } else if (getIsExecuteToolSpan(opType)) {
      toolCalls++;
      const toolName = getStringAttr(node, SpanFields.GEN_AI_TOOL_NAME);
      if (toolName) {
        toolNameSet.add(toolName);
        if (nodeHasError) {
          erroredToolNameSet.add(toolName);
        }
      }
    }

    if (nodeHasError) {
      errors++;
    }
  }

  const tokenBreakdowns = Array.from(tokensByModel.values()).sort(
    (a, b) => b.total - a.total
  );
  return {
    llmCalls,
    toolCalls,
    errors,
    startTimestamp,
    erroredToolNames: erroredToolNameSet,
    tokenBreakdowns,
    totalTokens: tokenBreakdowns.reduce((total, breakdown) => total + breakdown.total, 0),
    totalCost,
    toolNames: orderToolNames(Array.from(toolNameSet).sort(), erroredToolNameSet),
  };
}

/**
 * Derives the conversation's user from the first span node that carries any
 * user identity attribute. Returns null when the spans aren't user-instrumented.
 */
function getConversationUser(nodes: AITraceSpanNode[]): ConversationUser | null {
  for (const node of nodes) {
    const email = normalizeUserField(getStringAttr(node, SpanFields.USER_EMAIL));
    const username = normalizeUserField(getStringAttr(node, SpanFields.USER_USERNAME));
    const ipAddress = normalizeUserField(getStringAttr(node, SpanFields.USER_IP));
    const id = normalizeUserField(getStringAttr(node, SpanFields.USER_ID));
    if (email || username || ipAddress || id) {
      return {
        email,
        username,
        ip_address: ipAddress,
        id,
      };
    }
  }
  return null;
}

const AGGREGATES_BAR_VISIBLE_TOOL_COUNT = 4;

/**
 * Aggregate metrics row for a conversation (LLM Calls, Errors, Tokens, Cost, Tools).
 * Used standalone in the trace AI tab.
 */
export function ConversationAggregatesBar({
  stats,
  nodes,
  conversationId,
  isLoading,
  lastMessageDate,
  onErrorsLinkClick,
}: {
  conversationId: string;
  nodes: AITraceSpanNode[];
  isLoading?: boolean;
  lastMessageDate?: Date | null;
  onErrorsLinkClick?: () => void;
  stats?: ConversationApiStats | null;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const calculatedAggregates = useMemo(() => calculateAggregates(nodes), [nodes]);
  const aggregateValues = stats ?? calculatedAggregates;
  const tokenBreakdowns = stats
    ? getTokenBreakdowns(stats.usageByModel)
    : calculatedAggregates.tokenBreakdowns;
  const toolNames = orderToolNames(
    aggregateValues.toolNames,
    calculatedAggregates.erroredToolNames
  );

  const errorsUrl = getExploreUrl({
    organization,
    selection,
    query: `gen_ai.conversation.id:"${escapeDoubleQuotes(
      conversationId
    )}" span.status:[internal_error,error]`,
  });

  // minHeight matches the tool Tag height so the row stays the same height whether or not tools render
  return (
    <Flex align="center" gap="lg" minWidth={0} minHeight="20px">
      <AggregateItem
        label={t('LLM Calls')}
        value={<Count value={aggregateValues.llmCalls} />}
        isLoading={isLoading}
      />
      <AggregateItem
        label={t('Errors')}
        value={<Count value={calculatedAggregates.errors} />}
        to={calculatedAggregates.errors > 0 ? errorsUrl : undefined}
        isLoading={isLoading}
        onClick={calculatedAggregates.errors > 0 ? onErrorsLinkClick : undefined}
      />
      <AggregateItem
        label={t('Tokens')}
        value={
          <TokenCount breakdowns={tokenBreakdowns} total={aggregateValues.totalTokens} />
        }
        isLoading={isLoading}
      />
      <AggregateItem
        label={t('Cost')}
        value={
          <CostCount breakdowns={tokenBreakdowns} total={aggregateValues.totalCost} />
        }
        isLoading={isLoading}
      />
      {lastMessageDate !== undefined && (
        <AggregateItem
          label={t('Last message')}
          value={
            lastMessageDate ? (
              <TimeSince date={lastMessageDate} />
            ) : (
              <Text size="sm" variant="muted">
                {'—'}
              </Text>
            )
          }
          isLoading={isLoading}
        />
      )}
      {isLoading ? (
        <Flex align="center" gap="xs" flexShrink={0}>
          <Text size="sm" bold variant="muted">
            {t('Used Tools')}
          </Text>
          <Placeholder width="60px" height="14px" />
        </Flex>
      ) : (
        toolNames.length > 0 && (
          <ToolTagsRow>
            <Text size="sm" bold variant="muted" wrap="nowrap">
              {t('Used Tools')}
            </Text>
            {toolNames.slice(0, AGGREGATES_BAR_VISIBLE_TOOL_COUNT).map(name => (
              <Tag key={name} variant="info">
                {name}
              </Tag>
            ))}
            {toolNames.length > AGGREGATES_BAR_VISIBLE_TOOL_COUNT && (
              <InfoText
                size="sm"
                variant="muted"
                wrap="nowrap"
                title={
                  <Flex wrap="wrap" gap="xs" paddingTop="xs" paddingBottom="xs">
                    {toolNames.slice(AGGREGATES_BAR_VISIBLE_TOOL_COUNT).map(name => (
                      <Tag key={name} variant="info">
                        {name}
                      </Tag>
                    ))}
                  </Flex>
                }
              >
                {t('+%s more', toolNames.length - AGGREGATES_BAR_VISIBLE_TOOL_COUNT)}
              </InfoText>
            )}
          </ToolTagsRow>
        )
      )}
    </Flex>
  );
}

function CostCount({
  breakdowns,
  total,
}: {
  breakdowns: TokenBreakdownDetails[];
  total: number;
}) {
  const value = total < 0 ? <NegativeCostInfo cost={total} /> : <LLMCosts cost={total} />;

  if (total <= 0 || !breakdowns.some(breakdown => breakdown.totalCost !== undefined)) {
    return value;
  }

  return (
    <Tooltip title={<TokenBreakdownTooltip breakdowns={breakdowns} />}>
      <BreakdownValue>{value}</BreakdownValue>
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
  return (
    <Tooltip title={<TokenBreakdownTooltip breakdowns={breakdowns} />}>
      <BreakdownValue>{formatAbbreviatedNumber(total)}</BreakdownValue>
    </Tooltip>
  );
}

function AggregateItem({
  label,
  value,
  to,
  isLoading,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  isLoading?: boolean;
  onClick?: () => void;
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
    return (
      <StyledLink to={to} onClick={onClick}>
        {content}
      </StyledLink>
    );
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
