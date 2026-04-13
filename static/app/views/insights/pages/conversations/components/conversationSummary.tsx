import type React from 'react';
import {useCallback, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Placeholder} from 'sentry/components/placeholder';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getExploreUrl} from 'sentry/views/explore/utils';
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

interface ConversationAggregates {
  errorCount: number;
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

  for (const node of nodes) {
    const opType = getGenAiOpType(node);

    if (getIsAiGenerationSpan(opType)) {
      llmCalls++;
      totalTokens += getNumberAttr(node, SpanFields.GEN_AI_USAGE_TOTAL_TOKENS) ?? 0;
      totalCost += getNumberAttr(node, SpanFields.GEN_AI_COST_TOTAL_TOKENS) ?? 0;
    } else if (getIsExecuteToolSpan(opType)) {
      toolCalls++;
      const toolName = getStringAttr(node, SpanFields.GEN_AI_TOOL_NAME);
      if (toolName) {
        toolNameSet.add(toolName);
      }
    }

    if (hasError(node)) {
      errorCount++;
    }
  }

  return {
    llmCalls,
    toolCalls,
    errorCount,
    totalTokens,
    totalCost,
    toolNames: Array.from(toolNameSet).sort(),
  };
}

export function ConversationSummary({
  nodes,
  conversationId,
  isLoading,
  nodeTraceMap,
}: ConversationSummaryProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const aggregates = useMemo(() => calculateAggregates(nodes), [nodes]);

  const handleCopyConversationId = useCallback(() => {
    copyToClipboard(conversationId, {
      successMessage: t('Copied conversation ID to clipboard'),
    });
  }, [conversationId]);

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

  const errorsUrl = getExploreUrl({
    organization,
    selection,
    query: `gen_ai.conversation.id:${conversationId} span.status:internal_error`,
  });

  return (
    <Flex direction="column" gap="md" flex={1}>
      <Flex align="center" gap="sm">
        <Heading as="h2">{t('Conversation #%s', conversationId.slice(0, 8))}</Heading>
        <Tooltip title={t('Copy conversation ID')}>
          <Button
            size="zero"
            priority="transparent"
            aria-label={t('Copy conversation ID')}
            icon={<IconCopy size="xs" />}
            onClick={handleCopyConversationId}
          />
        </Tooltip>
        {traces.length > 0 && (
          <Flex align="baseline" gap="xs">
            <Text size="sm" variant="muted">
              {traces.length === 1 ? t('Trace') : t('Traces')}
            </Text>
            {traces.map((trace, i) => (
              <Flex key={trace.traceId} align="baseline" gap="xs">
                {i > 0 && (
                  <Text size="sm" variant="muted">
                    {','}
                  </Text>
                )}
                <StyledLink
                  to={normalizeUrl(
                    `/organizations/${organization.slug}/explore/traces/trace/${trace.traceId}/?node=span-${trace.spanId}`
                  )}
                >
                  <Text size="sm" monospace>
                    {trace.traceId.slice(0, 8)}
                  </Text>
                </StyledLink>
              </Flex>
            ))}
          </Flex>
        )}
      </Flex>
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
        />
        <AggregateItem
          label={t('Tokens')}
          value={<Count value={aggregates.totalTokens} />}
          isLoading={isLoading}
        />
        <AggregateItem
          label={t('Cost')}
          value={formatLLMCosts(aggregates.totalCost)}
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
              <Text size="sm" bold variant="muted" style={{whiteSpace: 'nowrap'}}>
                {t('Used Tools')}
              </Text>
              {aggregates.toolNames.map(name => (
                <Tag key={name} variant="info">
                  {name}
                </Tag>
              ))}
            </ToolTagsRow>
          )
        )}
      </Flex>
    </Flex>
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
