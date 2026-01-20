import {Fragment, memo, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex, Stack} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {IconChat, IconChevron, IconCode, IconFire, IconFix} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {t} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {
  getGenAiOpType,
  getIsAiAgentNode,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  getIsAiAgentSpan,
  getIsAiGenerationSpan,
  getIsExecuteToolSpan,
  getIsHandoffSpan,
} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {
  isEAPSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import type {TransactionNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/transactionNode';

function getNodeTimeBounds(node: AITraceSpanNode | AITraceSpanNode[]) {
  let startTime = 0;
  let endTime = 0;

  if (Array.isArray(node)) {
    const totalStartAndEndTime = node.reduce(
      (acc, n) => {
        const bounds = getNodeTimeBounds(n);
        return {
          startTime: Math.min(acc.startTime, bounds.startTime),
          endTime: Math.max(acc.endTime, bounds.endTime),
        };
      },
      {startTime: Infinity, endTime: 0}
    );
    startTime = totalStartAndEndTime.startTime;
    endTime = totalStartAndEndTime.endTime;
  } else {
    if (!node.startTimestamp || !node.endTimestamp)
      return {startTime: 0, endTime: 0, duration: 0};

    startTime = node.startTimestamp;
    endTime = node.endTimestamp;
  }

  if (endTime === 0) return {startTime: 0, endTime: 0, duration: 0};

  return {
    startTime,
    endTime,
    duration: endTime - startTime,
  };
}

export function AISpanList({
  nodes,
  selectedNodeKey,
  onSelectNode,
  compressGaps = false,
}: {
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeKey: string | null;
  compressGaps?: boolean;
}) {
  const nodesByTransaction = useMemo(() => {
    const result: Map<
      TransactionNode | EapSpanNode | AITraceSpanNode,
      AITraceSpanNode[]
    > = new Map();
    // Use a placeholder key for nodes without a transaction (e.g., conversation view)
    let orphanGroup: AITraceSpanNode | null = null;

    for (const node of nodes) {
      // TODO: We should consider using BaseNode.expand to control toggle state,
      // instead of grouping by transactions for toggling by transactions only.
      // This would allow us to avoid using type guards/checks like below, outside of the BaseNode classes.
      const isNodeTransaction =
        isTransactionNode(node) || (isEAPSpanNode(node) && node.value.is_transaction);
      const transaction = isNodeTransaction ? node : node.findClosestParentTransaction();
      const groupKey = transaction ?? (orphanGroup ??= node);
      const transactionNodes = result.get(groupKey) || [];
      result.set(groupKey, [...transactionNodes, node]);
    }
    return result;
  }, [nodes]);

  return (
    <Stack gap="xs">
      {Array.from(nodesByTransaction.entries()).map(([transaction, transactionNodes]) => (
        <TransactionWrapper
          key={transaction.id}
          canCollapse={nodesByTransaction.size > 1}
          transaction={transaction}
          nodes={transactionNodes}
          onSelectNode={onSelectNode}
          selectedNodeKey={selectedNodeKey}
          compressGaps={compressGaps}
        />
      ))}
    </Stack>
  );
}

function TransactionWrapper({
  canCollapse,
  nodes,
  onSelectNode,
  selectedNodeKey,
  transaction,
  compressGaps = false,
}: {
  canCollapse: boolean;
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeKey: string | null;
  transaction: TransactionNode | EapSpanNode | AITraceSpanNode;
  compressGaps?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const theme = useTheme();
  const colors = [...theme.chart.getColorPalette(5), theme.colors.red400];

  const compressedBounds = useMemo(
    () => (compressGaps ? getCompressedTimeBounds(nodes) : null),
    [compressGaps, nodes]
  );
  const timeBounds = compressedBounds ?? getNodeTimeBounds(nodes);

  const nodeAiRunParentsMap = useMemo<Record<string, AITraceSpanNode>>(() => {
    const parents: Record<string, AITraceSpanNode> = {};
    for (const node of nodes) {
      const parent = getIsAiAgentNode(node)
        ? node
        : (node as AITraceSpanNode).findParent<AITraceSpanNode>(p => getIsAiAgentNode(p));
      if (parent) {
        parents[node.id] = parent;
      }
    }
    return parents;
  }, [nodes]);

  const handleCollapse = () => {
    setIsExpanded(prevValue => !prevValue);
  };

  const title =
    'transaction' in transaction.value
      ? transaction.value.transaction
      : transaction.value.description;

  const showHeader = canCollapse || !!title;

  return (
    <Fragment>
      {showHeader && (
        <TransactionButton type="button" disabled={!canCollapse} onClick={handleCollapse}>
          {canCollapse ? (
            <StyledIconChevron direction={isExpanded ? 'down' : 'right'} />
          ) : null}
          <Tooltip title={title} showOnlyOnOverflow skipWrapper delay={500}>
            <span>{title}</span>
          </Tooltip>
        </TransactionButton>
      )}
      {isExpanded &&
        nodes.map(node => {
          const aiRunNode = nodeAiRunParentsMap[node.id];

          // Only indent if the node is not the ai run node
          const shouldIndent = aiRunNode && aiRunNode !== node;

          const uniqueKey = node.id;
          return (
            <TraceListItem
              indent={shouldIndent ? 1 : 0}
              traceBounds={timeBounds}
              key={uniqueKey}
              node={node}
              onClick={() => onSelectNode(node)}
              isSelected={uniqueKey === selectedNodeKey}
              colors={colors}
              compressedStartByNodeId={compressedBounds?.compressedStartByNodeId}
            />
          );
        })}
    </Fragment>
  );
}

const TraceListItem = memo(function TraceListItem({
  node,
  onClick,
  isSelected,
  colors,
  traceBounds,
  indent,
  compressedStartByNodeId,
}: {
  colors: readonly string[];
  indent: number;
  isSelected: boolean;
  node: AITraceSpanNode;
  onClick: () => void;
  traceBounds: TraceBounds;
  compressedStartByNodeId?: Map<string, number>;
}) {
  const hasErrors = hasError(node);
  const {icon, title, subtitle, color} = getNodeInfo(node, colors);
  const safeColor = color || colors[0] || '#9ca3af';
  const relativeTiming = calculateRelativeTiming(
    node,
    traceBounds,
    compressedStartByNodeId
  );
  const duration = getNodeTimeBounds(node).duration;

  return (
    <ListItemContainer
      hasErrors={hasErrors}
      isSelected={isSelected}
      onClick={onClick}
      indent={indent}
    >
      <Flex
        align="center"
        position="relative"
        style={{color: safeColor, background: 'inherit'}}
      >
        {icon}
        {hasErrors && (
          <Tooltip delay={300} title={t('This span encountered an error')} skipWrapper>
            <Container
              position="absolute"
              radius="full"
              style={{bottom: -6, right: -6, padding: 1, background: 'inherit'}}
            >
              <IconFire display="block" size="xs" variant="danger" />
            </Container>
          </Tooltip>
        )}
      </Flex>
      <Stack gap="xs" flex="1" minWidth="0">
        <Flex align="center" gap="xs">
          <Container maxWidth="40%" flexShrink={0}>
            <Tooltip title={title} showOnlyOnOverflow skipWrapper delay={500}>
              <Text bold size="sm" ellipsis>
                {title}
              </Text>
            </Tooltip>
          </Container>
          {subtitle && (
            <Tooltip
              title={subtitle}
              showOnlyOnOverflow
              skipWrapper
              delay={500}
              maxWidth={500}
            >
              <Text size="sm" variant="muted" ellipsis>
                - {subtitle}
              </Text>
            </Tooltip>
          )}
          <Container flex={1} />
          <Text size="xs" variant="muted">
            {getDuration(duration, 2, true, true)}
          </Text>
        </Flex>
        <DurationBar color={safeColor} relativeTiming={relativeTiming} />
      </Stack>
    </ListItemContainer>
  );
});

interface TraceBounds {
  duration: number;
  endTime: number;
  startTime: number;
}

interface CompressedTimeBounds extends TraceBounds {
  compressedStartByNodeId: Map<string, number>;
}

const MAX_GAP_SECONDS = 30;
const COMPRESSED_GAP_SECONDS = 1;

/**
 * Compresses large time gaps between spans to make the timeline more readable.
 * Gaps larger than MAX_GAP_SECONDS are compressed to COMPRESSED_GAP_SECONDS.
 *
 * This function handles nested/overlapping spans by tracking "segments" - continuous
 * time ranges where spans are active. When a gap is detected between segments,
 * it's compressed if larger than MAX_GAP_SECONDS.
 *
 * Returns a Map of node IDs to their compressed start times, which allows O(1)
 * lookup when rendering each span's position on the timeline.
 */
function getCompressedTimeBounds(nodes: AITraceSpanNode[]): CompressedTimeBounds {
  const emptyResult: CompressedTimeBounds = {
    startTime: 0,
    endTime: 0,
    duration: 0,
    compressedStartByNodeId: new Map(),
  };

  if (nodes.length === 0) {
    return emptyResult;
  }

  const sortedNodes = [...nodes]
    .filter(n => n.startTimestamp && n.endTimestamp)
    .sort((a, b) => (a.startTimestamp ?? 0) - (b.startTimestamp ?? 0));

  if (sortedNodes.length === 0) {
    return emptyResult;
  }

  const compressedStartByNodeId = new Map<string, number>();

  // Track current segment bounds - a segment is a continuous time range
  // where at least one span is active (handles overlapping/nested spans)
  const firstNode = sortedNodes[0]!;
  let segmentRealStart = firstNode.startTimestamp!;
  let segmentRealEnd = firstNode.endTimestamp!;
  let segmentCompressedStart = 0;

  compressedStartByNodeId.set(firstNode.id, 0);

  for (let i = 1; i < sortedNodes.length; i++) {
    const node = sortedNodes[i]!;
    const nodeStart = node.startTimestamp!;
    const nodeEnd = node.endTimestamp!;

    if (nodeStart > segmentRealEnd) {
      // Gap detected - finish current segment and start new one
      const gap = nodeStart - segmentRealEnd;
      const compressedGap = gap > MAX_GAP_SECONDS ? COMPRESSED_GAP_SECONDS : gap;
      const segmentDuration = segmentRealEnd - segmentRealStart;

      // Advance compressed time by segment duration + gap
      segmentCompressedStart += segmentDuration + compressedGap;

      // Start new segment
      segmentRealStart = nodeStart;
      segmentRealEnd = nodeEnd;
    } else {
      // Overlapping/nested span - extend current segment if needed
      segmentRealEnd = Math.max(segmentRealEnd, nodeEnd);
    }

    // Calculate this node's compressed start relative to the current segment
    const offsetInSegment = nodeStart - segmentRealStart;
    compressedStartByNodeId.set(node.id, segmentCompressedStart + offsetInSegment);
  }

  // Total duration is the compressed start of last segment + its duration
  const totalDuration = segmentCompressedStart + (segmentRealEnd - segmentRealStart);

  return {
    startTime: 0,
    endTime: totalDuration,
    duration: totalDuration,
    compressedStartByNodeId,
  };
}

function calculateRelativeTiming(
  node: AITraceSpanNode,
  traceBounds: TraceBounds,
  compressedStartByNodeId?: Map<string, number>
): {leftPercent: number; widthPercent: number} {
  if (!node.value) return {leftPercent: 0, widthPercent: 0};

  let startTime: number, endTime: number;

  if (node.startTimestamp && node.endTimestamp) {
    startTime = node.startTimestamp;
    endTime = node.endTimestamp;
  } else {
    return {leftPercent: 0, widthPercent: 0};
  }

  if (traceBounds.duration === 0) return {leftPercent: 0, widthPercent: 0};

  // Look up the pre-computed compressed start time for this node.
  // The span duration stays the same - only gaps between spans are compressed.
  const compressedStart = compressedStartByNodeId?.get(node.id);
  const effectiveStart =
    compressedStart === undefined ? startTime - traceBounds.startTime : compressedStart;
  const effectiveEnd =
    compressedStart === undefined
      ? endTime - traceBounds.startTime
      : compressedStart + (endTime - startTime);

  const relativeStart = Math.max(0, effectiveStart / traceBounds.duration) * 100;
  const spanDuration = ((effectiveEnd - effectiveStart) / traceBounds.duration) * 100;

  const minWidth = 2;
  const adjustedWidth = Math.max(spanDuration, minWidth);

  const maxAllowedStart = 100 - adjustedWidth;
  const adjustedStart = Math.min(relativeStart, maxAllowedStart);

  return {leftPercent: adjustedStart, widthPercent: adjustedWidth};
}

interface NodeInfo {
  color: string | undefined;
  icon: React.ReactNode;
  subtitle: React.ReactNode;
  title: React.ReactNode;
}

function getNodeInfo(node: AITraceSpanNode, colors: readonly string[]) {
  // Default return value
  const nodeInfo: NodeInfo = {
    icon: <IconCode size="md" />,
    title: node.description,
    subtitle: node.op,
    color: colors[1],
  };

  const op = node.op ?? 'default';
  const truncatedOp = op.startsWith('gen_ai.') ? op.slice(7) : op;
  nodeInfo.title = truncatedOp;
  const genAiOpType = getGenAiOpType(node);
  if (getIsAiAgentSpan(genAiOpType)) {
    const agentName =
      node.attributes?.[SpanFields.GEN_AI_AGENT_NAME] ||
      node.attributes?.[SpanFields.GEN_AI_FUNCTION_ID] ||
      '';
    const model =
      node.attributes?.[SpanFields.GEN_AI_REQUEST_MODEL] ||
      node.attributes?.[SpanFields.GEN_AI_RESPONSE_MODEL] ||
      '';
    nodeInfo.icon = <IconBot size="md" />;
    nodeInfo.title = agentName || truncatedOp;
    nodeInfo.subtitle = truncatedOp;
    if (model) {
      nodeInfo.subtitle = (
        <Fragment>
          {nodeInfo.subtitle} ({model})
        </Fragment>
      );
    }
    nodeInfo.color = colors[0];
  } else if (getIsAiGenerationSpan(genAiOpType)) {
    const tokens = node.attributes?.[SpanFields.GEN_AI_USAGE_TOTAL_TOKENS] as
      | number
      | undefined;
    const cost = node.attributes?.[SpanFields.GEN_AI_COST_TOTAL_TOKENS] as
      | number
      | undefined;
    nodeInfo.title = node.description || nodeInfo.title;
    nodeInfo.icon = <IconChat size="md" />;
    nodeInfo.subtitle = tokens ? (
      <Fragment>
        <Count value={tokens} />
        {' Tokens'}
      </Fragment>
    ) : (
      ''
    );
    if (cost) {
      nodeInfo.subtitle = (
        <Fragment>
          {nodeInfo.subtitle} ({<LLMCosts cost={cost} />})
        </Fragment>
      );
    }
    nodeInfo.color = colors[2];
  } else if (getIsExecuteToolSpan(genAiOpType)) {
    const toolName = node.attributes?.[SpanFields.GEN_AI_TOOL_NAME] as string | undefined;
    nodeInfo.icon = <IconFix size="md" />;
    nodeInfo.title = toolName || truncatedOp;
    nodeInfo.subtitle = toolName ? truncatedOp : '';
    nodeInfo.color = colors[5];
  } else if (getIsHandoffSpan(genAiOpType)) {
    nodeInfo.icon = <IconChevron size="md" isDouble direction="right" />;
    nodeInfo.subtitle = node.description || '';
    nodeInfo.color = colors[4];
  } else {
    nodeInfo.subtitle = node.description || '';
  }

  // Override the color and icon if the node has errors
  if (hasError(node)) {
    nodeInfo.color = colors[6];
  }

  return nodeInfo;
}

function hasError(node: AITraceSpanNode) {
  if (node.errors.size > 0) {
    return true;
  }

  const spanStatus = node.attributes?.[SpanFields.SPAN_STATUS] as string | undefined;
  if (!!spanStatus && typeof spanStatus === 'string') {
    return spanStatus.includes('error');
  }
  const status = node.attributes?.status;
  if (!!status && typeof status === 'string') {
    return status.includes('error');
  }

  return false;
}

const ListItemContainer = styled('div')<{
  hasErrors: boolean;
  indent: number;
  isSelected: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xs};
  padding-left: ${p => (p.indent ? p.indent * 16 : 4)}px;
  border-radius: ${p => p.theme.radius.md};
  cursor: pointer;
  background-color: ${p =>
    p.isSelected
      ? p.theme.tokens.background.secondary
      : p.theme.tokens.background.primary};
  outline: ${p =>
    p.isSelected
      ? p.hasErrors
        ? `2px solid ${p.theme.tokens.focus.invalid}`
        : `2px solid ${p.theme.tokens.focus.default}`
      : 'none'};

  &:hover {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &:active {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;

const DurationBar = styled('div')<{
  color: string;
  relativeTiming: {leftPercent: number; widthPercent: number};
}>`
  width: 100%;
  height: 4px;
  background-color: ${p => p.theme.tokens.dataviz.semantic.other};
  border-radius: 2px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: ${p => p.relativeTiming.leftPercent}%;
    top: 0;
    height: 100%;
    width: ${p => p.relativeTiming.widthPercent}%;
    background-color: ${p => p.color};
    border-radius: 2px;
  }
`;

const TransactionButton = styled('button')`
  position: relative;
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.sm};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  margin-top: ${p => p.theme.space.md};
  gap: ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.radius.md};
  background: transparent;
  border: none;
  outline: none;
  justify-content: flex-start;
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.fontWeight.normal};

  &:hover:not(:disabled) {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &:active:not(:disabled) {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.active};
  }

  &:first-child {
    margin-top: 0;
  }

  & > span {
    display: block;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
    text-align: left;
  }
`;

const StyledIconChevron = styled(IconChevron)`
  flex-shrink: 0;
`;
