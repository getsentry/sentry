import type React from 'react';
import {Fragment, useMemo} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
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
import {getDuration} from 'sentry/utils/duration/getDuration';
import {isUUID} from 'sentry/utils/string/isUUID';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getUserDisplayName,
  UserNotInstrumentedTooltip,
} from 'sentry/views/explore/conversations/components/conversationsTable';
import {getTraceUrl} from 'sentry/views/explore/conversations/components/conversationSummary';
import {ToolTag} from 'sentry/views/explore/conversations/components/toolTag';
import type {ConversationToolSummary} from 'sentry/views/explore/conversations/hooks/useConversationMeta';
import {useConversationMeta} from 'sentry/views/explore/conversations/hooks/useConversationMeta';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {NegativeCostInfo} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';
import {formatLLMCosts} from 'sentry/views/insights/pages/agents/utils/formatLLMCosts';

interface ConversationSummaryNewProps {
  conversationId: string;
  nodeTraceMap?: Map<string, string>;
}

const VISIBLE_TOOL_COUNT = 6;

export function ConversationSummaryNew({
  conversationId,
  nodeTraceMap,
}: ConversationSummaryNewProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const {data: meta, isLoading} = useConversationMeta({conversationId});
  const tools = meta?.tools ?? [];
  const user = meta?.user ?? null;
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

  const errorCount = meta?.errors ?? 0;
  const totalTokens = meta?.totalTokens ?? 0;
  const toolCalls = meta?.toolCalls ?? 0;
  const totalCost = meta?.totalCost ?? 0;

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
          <Tooltip
            title={conversationId}
            showOnlyOnOverflow={!isUUID(conversationId)}
            skipWrapper
          >
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
              {tools.length > 0 && (
                <Flex align="center" gap="sm" minWidth={0} wrap="wrap">
                  {tools.slice(0, VISIBLE_TOOL_COUNT).map(tool => (
                    <ToolTag key={tool.name} name={tool.name} hasError={tool.hasError} />
                  ))}
                  {tools.length > VISIBLE_TOOL_COUNT && (
                    <InfoText
                      size="sm"
                      variant="muted"
                      wrap="nowrap"
                      title={
                        <Flex wrap="wrap" gap="sm" paddingTop="xs" paddingBottom="xs">
                          {tools.slice(VISIBLE_TOOL_COUNT).map(tool => (
                            <ToolTag
                              key={tool.name}
                              name={tool.name}
                              hasError={tool.hasError}
                            />
                          ))}
                        </Flex>
                      }
                    >
                      {t('+%s more', tools.length - VISIBLE_TOOL_COUNT)}
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
          value={<Count value={meta?.llmCalls ?? 0} />}
          isLoading={isLoading}
        />
        <Stat
          label={t('Tool Calls')}
          value={<Count value={toolCalls} />}
          tooltip={toolCalls > 0 ? <ToolCallsBreakdown tools={tools} /> : undefined}
          isLoading={isLoading}
        />
        <Stat
          label={t('Errors')}
          value={<Count value={errorCount} />}
          to={errorCount > 0 ? errorsUrl : undefined}
          onClick={
            errorCount > 0
              ? () =>
                  trackAnalytics('conversations.detail.click-errors-link', {organization})
              : undefined
          }
          isLoading={isLoading}
        />
        <Stat
          label={t('Tokens')}
          value={<Count value={totalTokens} />}
          tooltip={
            totalTokens > 0 ? (
              <TokensBreakdown
                inputTokens={meta?.inputTokens ?? 0}
                outputTokens={meta?.outputTokens ?? 0}
                totalTokens={totalTokens}
              />
            ) : undefined
          }
          isLoading={isLoading}
        />
        <Stat
          label={t('Cost')}
          value={
            totalCost < 0 ? (
              <NegativeCostInfo cost={totalCost} />
            ) : (
              formatLLMCosts(totalCost)
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
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  isLoading?: boolean;
  onClick?: () => void;
  to?: string;
  tooltip?: React.ReactNode;
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
        <InfoText size="xl" tabular wrap="nowrap" maxWidth={400} title={tooltip}>
          {value}
        </InfoText>
      )}
    </Stack>
  );
}

function ToolCallsBreakdown({tools}: {tools: ConversationToolSummary[]}) {
  return (
    <Grid columns="1fr max-content max-content" gap="md xl" align="center">
      {tools.map(tool => (
        <Fragment key={tool.name}>
          <Tag
            variant={tool.hasError ? 'danger' : 'muted'}
            title={tool.name}
            // Cap long tool names; the inner Text truncates with an ellipsis.
            style={{justifySelf: 'start', maxWidth: 200, minWidth: 0}}
          >
            <Text ellipsis variant="inherit">
              {tool.name}
            </Text>
          </Tag>
          <Text size="sm" tabular>
            <Count value={tool.calls} /> {tn('call', 'calls', tool.calls)}
          </Text>
          <Text size="sm" align="right" tabular>
            {getDuration(tool.duration / 1000, 1, true)}
          </Text>
        </Fragment>
      ))}
    </Grid>
  );
}

function TokensBreakdown({
  inputTokens,
  outputTokens,
  totalTokens,
}: {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}) {
  return (
    <Grid columns="1fr max-content" gap="md xl" align="center">
      <Text size="sm" align="left">
        {t('Input')}
      </Text>
      <Text size="sm" align="right" tabular>
        <Count value={inputTokens} />
      </Text>
      <Text size="sm" align="left">
        {t('Output')}
      </Text>
      <Text size="sm" align="right" tabular>
        <Count value={outputTokens} />
      </Text>
      <Text size="sm" align="left">
        {t('Total')}
      </Text>
      <Text size="sm" align="right" tabular>
        <Count value={totalTokens} />
      </Text>
    </Grid>
  );
}
