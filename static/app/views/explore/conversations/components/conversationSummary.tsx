import type React from 'react';
import {useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Placeholder} from 'sentry/components/placeholder';
import {TimeSince} from 'sentry/components/timeSince';
import {IconCopy} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isUUID} from 'sentry/utils/string/isUUID';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {normalizeUserField} from 'sentry/views/explore/conversations/components/conversationsTable';
import type {ConversationUser} from 'sentry/views/explore/conversations/hooks/useConversations';
import {getTimeBoundsFromNodes} from 'sentry/views/explore/conversations/utils/timeBounds';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {NegativeCostInfo} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';
import {
  getNumberAttr,
  getStringAttr,
  hasError,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {formatLLMCosts} from 'sentry/views/insights/pages/agents/utils/formatLLMCosts';
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
}

const VISIBLE_TRACE_COUNT = 5;
const VISIBLE_TOOL_COUNT = 4;

export function getTraceUrl(orgSlug: string, traceId: string, spanId: string) {
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

export function calculateAggregates(nodes: AITraceSpanNode[]): ConversationAggregates {
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
export function getConversationUser(nodes: AITraceSpanNode[]): ConversationUser | null {
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

/**
 * Aggregate metrics row for a conversation (LLM Calls, Errors, Tokens, Cost, Tools).
 * Used standalone in the trace AI tab, and as part of ConversationSummary on the detail page.
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
    query: `gen_ai.conversation.id:"${conversationId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" span.status:[internal_error,error]`,
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
            formatLLMCosts(aggregates.totalCost)
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
                {'\u2014'}
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
            {aggregates.toolNames.slice(0, VISIBLE_TOOL_COUNT).map(name => (
              <Tag key={name} variant="info">
                {name}
              </Tag>
            ))}
            {aggregates.toolNames.length > VISIBLE_TOOL_COUNT && (
              <InfoText
                size="sm"
                variant="muted"
                wrap="nowrap"
                title={
                  <Flex wrap="wrap" gap="xs" paddingTop="xs" paddingBottom="xs">
                    {aggregates.toolNames.slice(VISIBLE_TOOL_COUNT).map(name => (
                      <Tag key={name} variant="info">
                        {name}
                      </Tag>
                    ))}
                  </Flex>
                }
              >
                {t('+%s more', aggregates.toolNames.length - VISIBLE_TOOL_COUNT)}
              </InfoText>
            )}
          </ToolTagsRow>
        )
      )}
    </Flex>
  );
}

export function ConversationSummary({
  nodes,
  conversationId,
  isLoading,
  nodeTraceMap,
}: ConversationSummaryProps) {
  const organization = useOrganization();
  const lastMessageDate = useMemo(() => {
    const {endTimestamp} = getTimeBoundsFromNodes(nodes);
    return endTimestamp === undefined ? null : new Date(endTimestamp);
  }, [nodes]);

  const handleCopyConversationId = () => {
    trackAnalytics('conversations.detail.copy-conversation-id', {
      organization,
    });
    copyToClipboard(conversationId, {
      successMessage: t('Copied conversation ID to clipboard'),
    });
  };

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
    <Stack gap="md" flex={1}>
      <Flex align="center" gap="sm" minWidth={0}>
        <Tooltip
          title={conversationId}
          showOnlyOnOverflow
          skipWrapper
          disabled={isUUID(conversationId)}
        >
          <Heading as="h2" ellipsis style={{minWidth: 0, flexShrink: 1}}>
            {isUUID(conversationId)
              ? t('Conversation %s', conversationId.slice(0, 8))
              : t('Conversation %s', conversationId)}
          </Heading>
        </Tooltip>
        <Tooltip title={t('Copy conversation ID')}>
          <Button
            size="zero"
            variant="transparent"
            aria-label={t('Copy conversation ID')}
            icon={<IconCopy size="xs" />}
            onClick={handleCopyConversationId}
          />
        </Tooltip>
        {traces.length > 0 && (
          <Flex align="baseline" gap="xs">
            <Text size="sm" variant="muted">
              {tn('Trace', 'Traces', traces.length)}
            </Text>
            {traces.slice(0, VISIBLE_TRACE_COUNT).map((trace, i) => (
              <Flex key={trace.traceId} align="baseline" gap="xs">
                {i > 0 && (
                  <Text size="sm" variant="muted">
                    {','}
                  </Text>
                )}
                <StyledLink
                  to={getTraceUrl(organization.slug, trace.traceId, trace.spanId)}
                  onClick={() =>
                    trackAnalytics('conversations.detail.click-trace-link', {
                      organization,
                    })
                  }
                >
                  <Text size="sm" monospace variant="accent">
                    {trace.traceId.slice(0, 8)}
                  </Text>
                </StyledLink>
              </Flex>
            ))}
            {traces.length > VISIBLE_TRACE_COUNT && (
              <DropdownMenu
                size="sm"
                triggerLabel={
                  <Text size="sm" variant="muted">
                    {t('+%s more', traces.length - VISIBLE_TRACE_COUNT)}
                  </Text>
                }
                triggerProps={{
                  size: 'zero',
                  variant: 'transparent',
                  showChevron: false,
                }}
                items={traces.slice(VISIBLE_TRACE_COUNT).map(trace => ({
                  key: trace.traceId,
                  label: (
                    <Text size="sm" monospace>
                      {trace.traceId.slice(0, 8)}
                    </Text>
                  ),
                  textValue: trace.traceId,
                  to: getTraceUrl(organization.slug, trace.traceId, trace.spanId),
                }))}
              />
            )}
          </Flex>
        )}
      </Flex>
      <ConversationAggregatesBar
        nodes={nodes}
        conversationId={conversationId}
        isLoading={isLoading}
        lastMessageDate={lastMessageDate}
        onErrorsLinkClick={() =>
          trackAnalytics('conversations.detail.click-errors-link', {
            organization,
          })
        }
      />
    </Stack>
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
