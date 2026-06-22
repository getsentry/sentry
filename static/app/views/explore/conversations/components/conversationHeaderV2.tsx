import {useMemo} from 'react';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {Placeholder} from 'sentry/components/placeholder';
import {IconCopy, IconOpen, IconUser} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isUUID} from 'sentry/utils/string/isUUID';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromSlug} from 'sentry/utils/useProjectFromSlug';
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

interface ConversationHeaderV2Props {
  conversationId: string;
  nodeTraceMap: Map<string, string>;
  nodes: AITraceSpanNode[];
  isLoading?: boolean;
}

function getGenAiOpType(node: AITraceSpanNode): string | undefined {
  return getStringAttr(node, SpanFields.GEN_AI_OPERATION_TYPE);
}

function calculateAggregates(nodes: AITraceSpanNode[]) {
  let llmCalls = 0;
  let toolCalls = 0;
  let errorCount = 0;
  let totalTokens = 0;
  let totalCost = 0;
  const toolNameSet = new Set<string>();
  let userEmail: string | undefined;
  let projectSlug: string | undefined;

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

    if (!userEmail) {
      userEmail = getStringAttr(node, SpanFields.USER_EMAIL) || undefined;
    }
    if (!projectSlug) {
      projectSlug = node.projectSlug || undefined;
    }
  }

  return {
    llmCalls,
    toolCalls,
    errorCount,
    totalTokens,
    totalCost,
    toolNames: Array.from(toolNameSet).sort(),
    userEmail,
    projectSlug,
  };
}

function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  }
  return String(count);
}

export function ConversationHeaderV2({
  conversationId,
  nodes,
  nodeTraceMap,
  isLoading,
}: ConversationHeaderV2Props) {
  const organization = useOrganization();
  const aggregates = useMemo(() => calculateAggregates(nodes), [nodes]);

  const uniqueTraces = useMemo(() => {
    const seen = new Map<string, string>();
    for (const [spanId, traceId] of nodeTraceMap) {
      if (!seen.has(traceId)) {
        seen.set(traceId, spanId);
      }
    }
    return Array.from(seen, ([traceId, spanId]) => ({traceId, spanId}));
  }, [nodeTraceMap]);
  const project = useProjectFromSlug({
    organization,
    projectSlug: aggregates.projectSlug,
  });

  const handleCopyConversationId = () => {
    trackAnalytics('conversations.detail.copy-conversation-id', {
      organization,
    });
    copyToClipboard(conversationId, {
      successMessage: t('Copied conversation ID to clipboard'),
    });
  };

  const displayId = isUUID(conversationId) ? conversationId.slice(0, 10) : conversationId;

  return (
    <Flex align="center" justify="between" gap="lg" flex={1}>
      <Flex direction="column" gap="sm" minWidth={0} flex={1}>
        <Flex align="center" gap="md" flexShrink={0}>
          <Text size="xl" bold>
            {displayId}
          </Text>
          <Tooltip title={t('Copy conversation ID')}>
            <Button
              size="zero"
              variant="transparent"
              aria-label={t('Copy conversation ID')}
              icon={<IconCopy size="xs" />}
              onClick={handleCopyConversationId}
            />
          </Tooltip>
        </Flex>
        <Flex align="center" gap="md" wrap="wrap">
          {project && (
            <Flex align="center" gap="xs">
              <ProjectAvatar size={16} project={project} />
              <Text size="sm">{project.slug}</Text>
            </Flex>
          )}
          {aggregates.userEmail && (
            <Flex align="center" gap="xs">
              <IconUser size="xs" />
              <Text size="xs" variant="muted">
                {aggregates.userEmail}
              </Text>
            </Flex>
          )}
          {!isLoading && uniqueTraces.length > 0 && (
            <Flex align="center" gap="xs">
              {uniqueTraces.length === 1 ? (
                <LinkButton
                  size="xs"
                  variant="link"
                  icon={<IconOpen size="xs" />}
                  to={`/organizations/${organization.slug}/explore/traces/trace/${uniqueTraces[0].traceId}/?node=span-${uniqueTraces[0].spanId}`}
                >
                  {t('View Trace')}
                </LinkButton>
              ) : (
                <DropdownMenu
                  triggerProps={{
                    size: 'xs',
                    variant: 'link',
                    icon: <IconOpen size="xs" />,
                  }}
                  triggerLabel={tn('%s Trace', '%s Traces', uniqueTraces.length)}
                  items={uniqueTraces.map((trace, i) => ({
                    key: trace.traceId,
                    label: `${t('Trace')} ${i + 1} — ${trace.traceId.slice(0, 8)}`,
                    to: `/organizations/${organization.slug}/explore/traces/trace/${trace.traceId}/?node=span-${trace.spanId}`,
                  }))}
                />
              )}
            </Flex>
          )}
          {!isLoading && aggregates.toolNames.length > 0 && (
            <Flex align="center" gap="xs" wrap="wrap">
              {aggregates.toolNames.slice(0, 6).map(name => (
                <Tag key={name} variant="muted">
                  {name}
                </Tag>
              ))}
              {aggregates.toolNames.length > 6 && (
                <Text size="sm" variant="muted">
                  {t('+%s more', aggregates.toolNames.length - 6)}
                </Text>
              )}
            </Flex>
          )}
        </Flex>
      </Flex>
      <Flex align="start" gap="lg" flexShrink={0}>
        {isLoading ? (
          <Flex gap="lg">
            <Placeholder height="40px" width="60px" />
            <Placeholder height="40px" width="60px" />
            <Placeholder height="40px" width="60px" />
            <Placeholder height="40px" width="60px" />
          </Flex>
        ) : (
          <Flex align="start" gap="lg">
            <StatItem label={t('Messages')} value={String(aggregates.llmCalls)} />
            <StatItem label={t('Errors')} value={String(aggregates.errorCount)} />
            <StatItem
              label={t('Tokens')}
              value={formatTokenCount(aggregates.totalTokens)}
            />
            <StatItem label={t('Cost')} value={formatLLMCosts(aggregates.totalCost)} />
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}

function StatItem({label, value}: {label: string; value: string}) {
  return (
    <Flex direction="column" align="start" gap="xs">
      <Text size="sm" variant="muted" bold>
        {label}
      </Text>
      <Text size="2xl">{value}</Text>
    </Flex>
  );
}
