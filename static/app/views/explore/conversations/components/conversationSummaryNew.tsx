import type React from 'react';
import {Fragment, useMemo} from 'react';

import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Placeholder} from 'sentry/components/placeholder';
import {IconOpen, IconUser} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {escapeDoubleQuotes} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isUUID} from 'sentry/utils/string/isUUID';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getUserDisplayName,
  UserNotInstrumentedTooltip,
} from 'sentry/views/explore/conversations/components/conversationsTable';
import {
  calculateAggregates,
  getConversationUser,
  getTraceUrl,
} from 'sentry/views/explore/conversations/components/conversationSummary';
import {ToolTag} from 'sentry/views/explore/conversations/components/toolTag';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {NegativeCostInfo} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

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
                  <Tooltip title={userDisplayName} showOnlyOnOverflow skipWrapper>
                    <Text size="sm" variant="muted" ellipsis>
                      {userDisplayName}
                    </Text>
                  </Tooltip>
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
