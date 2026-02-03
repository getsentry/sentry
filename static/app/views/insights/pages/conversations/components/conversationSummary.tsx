import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import Count from 'sentry/components/count';
import Placeholder from 'sentry/components/placeholder';
import {IconChat, IconFire, IconFix} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {hasError} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
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
}

interface ConversationStats {
  errorCount: number;
  llmCalls: number;
  toolCalls: number;
  totalCost: number;
  totalTokens: number;
}

function getGenAiOpType(node: AITraceSpanNode): string | undefined {
  return node.attributes?.[SpanFields.GEN_AI_OPERATION_TYPE] as string | undefined;
}

function calculateStats(nodes: AITraceSpanNode[]): ConversationStats {
  let llmCalls = 0;
  let toolCalls = 0;
  let errorCount = 0;
  let totalTokens = 0;
  let totalCost = 0;

  for (const node of nodes) {
    const opType = getGenAiOpType(node);

    if (getIsAiGenerationSpan(opType)) {
      llmCalls++;
      totalTokens += Number(node.attributes?.[SpanFields.GEN_AI_USAGE_TOTAL_TOKENS] ?? 0);
      totalCost += Number(node.attributes?.[SpanFields.GEN_AI_COST_TOTAL_TOKENS] ?? 0);
    } else if (getIsExecuteToolSpan(opType)) {
      toolCalls++;
    }

    if (hasError(node)) {
      errorCount++;
    }
  }

  return {llmCalls, toolCalls, errorCount, totalTokens, totalCost};
}

export function ConversationSummary({
  nodes,
  conversationId,
  isLoading,
}: ConversationSummaryProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const theme = useTheme();
  const stats = useMemo(() => calculateStats(nodes), [nodes]);
  const colors = [...theme.chart.getColorPalette(5), theme.colors.red400];

  const baseQuery = `gen_ai.conversation.id:${conversationId}`;

  const llmCallsUrl = getExploreUrl({
    organization,
    selection,
    query: `${baseQuery} gen_ai.operation.type:ai_client`,
  });

  const toolCallsUrl = getExploreUrl({
    organization,
    selection,
    query: `${baseQuery} gen_ai.operation.type:tool`,
  });

  const errorsUrl = getExploreUrl({
    organization,
    selection,
    query: `${baseQuery} span.status:internal_error`,
  });

  return (
    <SummaryContainer>
      <Flex align="center" gap="sm" flexShrink={0}>
        <Text size="lg" bold>
          {t('Conversation')}
        </Text>
        <Text variant="muted" monospace>
          {conversationId.slice(0, 8)}
        </Text>
        <CopyToClipboardButton
          aria-label={t('Copy conversation ID')}
          borderless
          size="zero"
          text={conversationId}
        />
      </Flex>
      <Divider />
      <StatsRow>
        <StatItem
          icon={
            <span style={{color: colors[2]}}>
              <IconChat size="sm" />
            </span>
          }
          label={t('LLM Calls')}
          value={<Count value={stats.llmCalls} />}
          to={stats.llmCalls > 0 ? llmCallsUrl : undefined}
          isLoading={isLoading}
        />
        <StatItem
          icon={
            <span style={{color: colors[5]}}>
              <IconFix size="sm" />
            </span>
          }
          label={t('Tool Calls')}
          value={<Count value={stats.toolCalls} />}
          to={stats.toolCalls > 0 ? toolCallsUrl : undefined}
          isLoading={isLoading}
        />
        <StatItem
          icon={
            <span style={{color: colors[6]}}>
              <IconFire size="sm" />
            </span>
          }
          label={t('Errors')}
          value={<Count value={stats.errorCount} />}
          to={stats.errorCount > 0 ? errorsUrl : undefined}
          isLoading={isLoading}
        />
        <StatItem
          label={t('Tokens')}
          value={<Count value={stats.totalTokens} />}
          isLoading={isLoading}
        />
        <StatItem
          label={t('Cost')}
          value={formatLLMCosts(stats.totalCost)}
          isLoading={isLoading}
        />
      </StatsRow>
    </SummaryContainer>
  );
}

function StatItem({
  icon,
  label,
  value,
  to,
  isLoading,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  isLoading?: boolean;
  to?: string;
}) {
  const content = (
    <Flex gap="xs" align="center">
      {icon}
      <Text variant="muted">{label}</Text>
      {isLoading ? <Placeholder width="20px" height="16px" /> : <Text>{value}</Text>}
    </Flex>
  );

  if (to && !isLoading) {
    return <StyledLink to={to}>{content}</StyledLink>;
  }

  return content;
}

const SummaryContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.lg};
  flex: 1;
`;

const Divider = styled('div')`
  width: 1px;
  background-color: ${p => p.theme.tokens.border.primary};
  align-self: stretch;
`;

const StatsRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.lg};
  flex-wrap: wrap;
`;

const StyledLink = styled(Link)`
  &:hover {
    text-decoration: underline;
  }
`;
