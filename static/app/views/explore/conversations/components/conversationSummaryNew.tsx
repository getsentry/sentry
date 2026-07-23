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
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Placeholder} from 'sentry/components/placeholder';
import {TimeSince} from 'sentry/components/timeSince';
import {IconOpen, IconUser} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {escapeDoubleQuotes} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isUUID} from 'sentry/utils/string/isUUID';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getUserDisplayName,
  normalizeUserField,
  UserNotInstrumentedTooltip,
} from 'sentry/views/explore/conversations/components/conversationsTableNew';
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

interface ConversationSummaryNewProps {
  conversationId: string;
  nodes: AITraceSpanNode[];
  isLoading?: boolean;
  nodeTraceMap?: Map<string, string>;
}

const VISIBLE_TOOL_COUNT = 6;

export function ConversationSummaryNew({
  nodes,
  conversationId,
  isLoading,
  nodeTraceMap,
}: ConversationSummaryNewProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const aggregates = useMemo(() => calculateAggregates(nodes), [nodes]);
  const user = useMemo(() => getConversationUser(nodes), [nodes]);
  const userDisplayName = user ? getUserDisplayName(user) : null;

  const displayId = isUUID(conversationId) ? conversationId.slice(0, 8) : conversationId;

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

  // A single trace deep-links to the trace view; multiple traces open the
  // traces explorer filtered to this conversation.
  const singleTrace = traces.length === 1 ? traces[0] : undefined;
  const tracesUrl = singleTrace
    ? getTraceUrl(organization.slug, singleTrace.traceId, singleTrace.spanId)
    : getExploreUrl({
        organization,
        selection,
        query: `gen_ai.conversation.id:"${escapeDoubleQuotes(conversationId)}"`,
        table: 'trace',
      });

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
        <Container minWidth={0}>
          <Tooltip title={conversationId} showOnlyOnOverflow={!isUUID(conversationId)}>
            <Heading as="h2" ellipsis>
              {displayId}
            </Heading>
          </Tooltip>
        </Container>
        <Flex align="center" gap="xl" minWidth={0} wrap="wrap">
          {isLoading ? (
            <Fragment>
              <Flex align="center" gap="xs">
                <Placeholder width="16px" height="16px" />
                <Placeholder width="120px" height="14px" />
              </Flex>
              <Flex align="center" gap="xs">
                <Placeholder width="12px" height="12px" />
                <Placeholder width="40px" height="14px" />
              </Flex>
              <Flex align="center" gap="sm">
                <Placeholder width="72px" height="20px" />
                <Placeholder width="72px" height="20px" />
              </Flex>
            </Fragment>
          ) : (
            <Fragment>
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
              {traces.length > 0 && (
                <Link
                  to={tracesUrl}
                  onClick={() =>
                    trackAnalytics('conversations.detail.click-trace-link', {
                      organization,
                    })
                  }
                >
                  <Flex align="center" gap="xs">
                    <IconOpen size="xs" />
                    <Text size="sm" variant="inherit" wrap="nowrap">
                      {tn('Trace', 'Traces', traces.length)}
                    </Text>
                  </Flex>
                </Link>
              )}
              {aggregates.toolNames.length > 0 && (
                <Flex align="center" gap="sm" minWidth={0} wrap="wrap">
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
            </Fragment>
          )}
        </Flex>
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

function Stat({
  label,
  value,
  isLoading,
  to,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  isLoading?: boolean;
  onClick?: () => void;
  to?: string;
}) {
  const isInteractive = !!to && !isLoading;

  return (
    <Stack gap="xs" flexShrink={0}>
      <Text size="sm" variant="muted" bold wrap="nowrap">
        {label}
      </Text>
      {isLoading ? (
        <Placeholder width="32px" height="24px" />
      ) : isInteractive ? (
        <Link to={to} onClick={onClick}>
          <Text size="xl" tabular variant="danger" wrap="nowrap">
            {value}
          </Text>
        </Link>
      ) : (
        <Text size="xl" tabular wrap="nowrap">
          {value}
        </Text>
      )}
    </Stack>
  );
}

function getTraceUrl(orgSlug: string, traceId: string, spanId: string) {
  return normalizeUrl(
    `/organizations/${orgSlug}/explore/traces/trace/${traceId}/?node=span-${spanId}`
  );
}

interface ConversationAggregates {
  errorCount: number;
  erroredToolNames: Set<string>;
  llmCalls: number;
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
  const toolNameSet = new Set<string>();
  const erroredToolNameSet = new Set<string>();

  for (const node of nodes) {
    const opType = getGenAiOpType(node);
    const nodeHasError = hasError(node);

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

  return {
    llmCalls,
    toolCalls,
    errorCount,
    erroredToolNames: erroredToolNameSet,
    totalTokens,
    totalCost,
    toolNames: Array.from(toolNameSet).sort(),
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

  return (
    <Flex align="center" gap="lg" minWidth={0}>
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
