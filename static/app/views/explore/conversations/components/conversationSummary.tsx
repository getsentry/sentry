import type React from 'react';
import {Fragment, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

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
import {isUUID} from 'sentry/utils/string/isUUID';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getUserDisplayName,
  normalizeUserField,
  UserNotInstrumentedTooltip,
} from 'sentry/views/explore/conversations/components/conversationsTable';
import {ConversationTraceLink} from 'sentry/views/explore/conversations/components/conversationTraceLink';
import {ToolTag} from 'sentry/views/explore/conversations/components/toolTag';
import type {ConversationUser} from 'sentry/views/explore/conversations/hooks/useConversations';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {NegativeCostInfo} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';
import {
  getNumberAttr,
  getStringAttr,
  hasError,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  getIsAiGenerationSpan,
  getIsExecuteToolSpan,
} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

interface ConversationSummaryProps {
  conversationId: string;
  nodes: AITraceSpanNode[];
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
  nodes,
  conversationId,
  title,
  project,
  isLoading,
  nodeTraceMap,
}: ConversationSummaryProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const aggregates = useMemo(() => calculateAggregates(nodes), [nodes]);
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
    query: `gen_ai.conversation.id:"${escapeDoubleQuotes(conversationId)}" span.status:[internal_error,error]`,
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
      direction={{'screen:xs': 'column', 'screen:md': 'row'}}
      justify="between"
      align={{'screen:xs': 'stretch', 'screen:md': 'center'}}
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
            {aggregates.toolNames.length > 0 && (
              <Flex align="center" gap="sm" minWidth={0} wrap="wrap">
                <Text size="sm" wrap="nowrap">
                  {t('Tools:')}
                </Text>
                {aggregates.toolNames.slice(0, VISIBLE_TOOL_COUNT).map(name => (
                  <ToolTag
                    key={name}
                    name={name}
                    hasError={aggregates.erroredToolNames.has(name)}
                  />
                ))}
                {aggregates.toolNames.length > VISIBLE_TOOL_COUNT && (
                  <InfoText
                    size="sm"
                    variant="muted"
                    wrap="nowrap"
                    title={
                      <Flex wrap="wrap" gap="sm" paddingTop="xs" paddingBottom="xs">
                        {aggregates.toolNames.slice(VISIBLE_TOOL_COUNT).map(name => (
                          <ToolTag
                            key={name}
                            name={name}
                            hasError={aggregates.erroredToolNames.has(name)}
                          />
                        ))}
                      </Flex>
                    }
                  >
                    {t('+%s more', aggregates.toolNames.length - VISIBLE_TOOL_COUNT)}
                  </InfoText>
                )}
              </Flex>
            )}
            <MetaRow>
              {aggregates.startTimestamp !== null && (
                <Flex align="center" gap="xs">
                  <IconCalendar size="md" />
                  <InfoText
                    size="sm"
                    title={
                      <TimeSince
                        date={aggregates.startTimestamp}
                        disabledAbsoluteTooltip
                      />
                    }
                  >
                    <DateTime date={aggregates.startTimestamp} year timeZone />
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
          value={<Count value={aggregates.llmCalls} />}
          isLoading={isLoading}
        />
        <Stat
          label={t('Errors')}
          value={<Count value={aggregates.errorCount} />}
          icon={
            aggregates.errorCount > 0 ? (
              <IconFire
                size="sm"
                variant="danger"
                data-test-id="conversation-error-icon"
              />
            ) : undefined
          }
          to={aggregates.errorCount > 0 ? errorsUrl : undefined}
          onClick={
            aggregates.errorCount > 0
              ? () =>
                  trackAnalytics('conversations.detail.click-errors-link', {organization})
              : undefined
          }
          isLoading={isLoading}
        />
        <Stat
          label={t('Tokens')}
          value={<Count value={aggregates.totalTokens} />}
          isLoading={isLoading}
        />
        <Stat
          label={t('Cost')}
          value={
            aggregates.totalCost < 0 ? (
              <NegativeCostInfo cost={aggregates.totalCost} />
            ) : (
              <LLMCosts cost={aggregates.totalCost} />
            )
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

interface ConversationAggregates {
  errorCount: number;
  erroredToolNames: Set<string>;
  llmCalls: number;
  /** When the conversation began, or null when no span carries a start time. */
  startTimestamp: number | null;
  toolCalls: number;
  toolNames: string[];
  totalCost: number;
  totalTokens: number;
}

function getGenAiOpType(node: AITraceSpanNode): string | undefined {
  return getStringAttr(node, SpanFields.GEN_AI_OPERATION_TYPE);
}

function calculateAggregates(nodes: AITraceSpanNode[]): ConversationAggregates {
  let llmCalls = 0;
  let toolCalls = 0;
  let errorCount = 0;
  let totalTokens = 0;
  let totalCost = 0;
  let startTimestamp: number | null = null;
  const toolNameSet = new Set<string>();
  const erroredToolNameSet = new Set<string>();

  for (const node of nodes) {
    const opType = getGenAiOpType(node);
    const nodeHasError = hasError(node);

    // Nodes without a timestamp leave space at its [0, 0] default.
    const [nodeStart] = node.space;
    if (nodeStart > 0 && (startTimestamp === null || nodeStart < startTimestamp)) {
      startTimestamp = nodeStart;
    }

    if (getIsAiGenerationSpan(opType)) {
      llmCalls++;
      totalTokens += getNumberAttr(node, SpanFields.GEN_AI_USAGE_TOTAL_TOKENS) ?? 0;
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
      errorCount++;
    }
  }

  // Errored tools lead, so they survive the row's truncation.
  const sortedToolNames = Array.from(toolNameSet).sort();
  const toolNames = [
    ...sortedToolNames.filter(name => erroredToolNameSet.has(name)),
    ...sortedToolNames.filter(name => !erroredToolNameSet.has(name)),
  ];

  return {
    llmCalls,
    toolCalls,
    errorCount,
    startTimestamp,
    erroredToolNames: erroredToolNameSet,
    totalTokens,
    totalCost,
    toolNames,
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
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const aggregates = useMemo(() => calculateAggregates(nodes), [nodes]);

  const errorsUrl = getExploreUrl({
    organization,
    selection,
    query: `gen_ai.conversation.id:"${escapeDoubleQuotes(conversationId)}" span.status:[internal_error,error]`,
  });

  // minHeight matches the tool Tag height so the row stays the same height whether or not tools render
  return (
    <Flex align="center" gap="lg" minWidth={0} minHeight="20px">
      <AggregateItem
        label={t('LLM Calls')}
        value={<Count value={aggregates.llmCalls} />}
        isLoading={isLoading}
      />
      <AggregateItem
        label={t('Errors')}
        value={<Count value={aggregates.errorCount} />}
        to={aggregates.errorCount > 0 ? errorsUrl : undefined}
        isLoading={isLoading}
        onClick={aggregates.errorCount > 0 ? onErrorsLinkClick : undefined}
      />
      <AggregateItem
        label={t('Tokens')}
        value={<Count value={aggregates.totalTokens} />}
        isLoading={isLoading}
      />
      <AggregateItem
        label={t('Cost')}
        value={
          aggregates.totalCost < 0 ? (
            <NegativeCostInfo cost={aggregates.totalCost} />
          ) : (
            <LLMCosts cost={aggregates.totalCost} />
          )
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
