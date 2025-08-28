import {Fragment, memo, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import Count from 'sentry/components/count';
import {IconChevron, IconCode, IconFire} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {IconSpeechBubble} from 'sentry/icons/iconSpeechBubble';
import {IconTool} from 'sentry/icons/iconTool';
import {space} from 'sentry/styles/space';
import getDuration from 'sentry/utils/duration/getDuration';
import {LLMCosts} from 'sentry/views/insights/agents/components/llmCosts';
import {getIsAiRunNode} from 'sentry/views/insights/agents/utils/aiTraceNodes';
import {getNodeId} from 'sentry/views/insights/agents/utils/getNodeId';
import {
  getIsAiGenerationSpan,
  getIsAiRunSpan,
} from 'sentry/views/insights/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/agents/utils/types';
import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNode,
  isTransactionNodeEquivalent,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

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
    if (!node.value) return {startTime: 0, endTime: 0, duration: 0};

    startTime = node.value.start_timestamp;
    if (isTransactionNode(node) || isSpanNode(node)) {
      endTime = node.value.timestamp;
    } else if (isEAPSpanNode(node)) {
      endTime = node.value.end_timestamp;
    }
  }

  if (endTime === 0) return {startTime: 0, endTime: 0, duration: 0};

  return {
    startTime,
    endTime,
    duration: endTime - startTime,
  };
}

function getClosestNode<T extends AITraceSpanNode>(
  node: AITraceSpanNode,
  predicate: (node: TraceTreeNode) => node is T
): T | null {
  if (predicate(node)) {
    return node;
  }
  return TraceTree.ParentNode(node, predicate) as T | null;
}

export function AISpanList({
  nodes,
  selectedNodeKey,
  onSelectNode,
}: {
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeKey: string | null;
}) {
  const theme = useTheme();
  const colors = [...theme.chart.getColorPalette(5), theme.red300];

  let currentTransaction: TraceTreeNode<
    TraceTree.Transaction | TraceTree.EAPSpan
  > | null = null;
  let currentAiRunNode: AITraceSpanNode | undefined | null = null;
  let currentTimeBounds: TraceBounds = {
    startTime: 0,
    endTime: 0,
    duration: 0,
  };

  const nodeAiRunParentsMap = useMemo<Record<string, AITraceSpanNode>>(() => {
    const parents: Record<string, AITraceSpanNode> = {};
    for (const node of nodes) {
      const parent = getClosestNode(node, getIsAiRunNode);
      if (parent) {
        parents[getNodeId(node)] = parent;
      }
    }
    return parents;
  }, [nodes]);

  const nextNodeMap = useMemo<Record<string, AITraceSpanNode>>(() => {
    const nextNodes: Record<string, AITraceSpanNode> = {};
    for (let i = 0; i < nodes.length - 1; i++) {
      const node = nodes[i];
      const nextNode = nodes[i + 1];
      if (node && nextNode) {
        nextNodes[getNodeId(node)] = nextNode;
      }
    }
    return nextNodes;
  }, [nodes]);

  function getOrphanedSiblings(node: AITraceSpanNode) {
    const siblings: AITraceSpanNode[] = [];
    let currentNode: AITraceSpanNode | undefined = node;
    while (currentNode && !nodeAiRunParentsMap[getNodeId(currentNode)]) {
      siblings.push(currentNode);
      currentNode = nextNodeMap[getNodeId(currentNode)];
    }
    return siblings;
  }

  return (
    <TraceListContainer>
      {nodes.map(node => {
        // find the closest transaction node
        const transactionNode = getClosestNode(node, isTransactionNodeEquivalent);
        const aiRunNode = nodeAiRunParentsMap[getNodeId(node)];

        if (aiRunNode !== currentAiRunNode) {
          currentAiRunNode = aiRunNode;
          currentTimeBounds = aiRunNode
            ? getNodeTimeBounds(aiRunNode)
            : getNodeTimeBounds(getOrphanedSiblings(node));
        }

        let transactionName: string | null = null;
        if (transactionNode !== currentTransaction) {
          currentTransaction = transactionNode;
          if (
            transactionNode &&
            (isTransactionNode(transactionNode) || isEAPSpanNode(transactionNode))
          ) {
            transactionName = transactionNode.value.transaction;
          }
        }

        // Only indent if the node is a child of the last ai run node
        const shouldIndent =
          aiRunNode && !!TraceTree.ParentNode(node, n => n === aiRunNode);

        const uniqueKey = getNodeId(node);
        return (
          <Fragment key={uniqueKey}>
            {transactionName && <TransactionItem>{transactionName}</TransactionItem>}
            <TraceListItem
              indent={shouldIndent ? 1 : 0}
              traceBounds={currentTimeBounds}
              key={uniqueKey}
              node={node}
              onClick={() => onSelectNode(node)}
              isSelected={uniqueKey === selectedNodeKey}
              colors={colors}
            />
          </Fragment>
        );
      })}
    </TraceListContainer>
  );
}

const TraceListItem = memo(function TraceListItem({
  node,
  onClick,
  isSelected,
  colors,
  traceBounds,
  indent,
}: {
  colors: readonly string[];
  indent: number;
  isSelected: boolean;
  node: AITraceSpanNode;
  onClick: () => void;
  traceBounds: TraceBounds;
}) {
  const hasErrors = hasError(node);
  const {icon, title, subtitle, color} = getNodeInfo(node, colors);
  const safeColor = color || colors[0] || '#9ca3af';
  const relativeTiming = calculateRelativeTiming(node, traceBounds);
  const duration = getNodeTimeBounds(node).duration;

  return (
    <ListItemContainer
      hasErrors={hasErrors}
      isSelected={isSelected}
      onClick={onClick}
      indent={indent}
    >
      <ListItemIcon color={safeColor}>{icon} </ListItemIcon>
      <ListItemContent>
        <ListItemHeader align="center" gap="xs">
          <ListItemTitle>{title}</ListItemTitle>
          {subtitle && <ListItemSubtitle>- {subtitle}</ListItemSubtitle>}
          <FlexSpacer />
          <DurationText>{getDuration(duration, 2, true, true)}</DurationText>
        </ListItemHeader>
        <DurationBar color={safeColor} relativeTiming={relativeTiming} />
      </ListItemContent>
    </ListItemContainer>
  );
});

interface TraceBounds {
  duration: number;
  endTime: number;
  startTime: number;
}

function calculateRelativeTiming(
  node: TraceTreeNode<TraceTree.NodeValue>,
  traceBounds: TraceBounds
): {leftPercent: number; widthPercent: number} {
  if (!node.value) return {leftPercent: 0, widthPercent: 0};

  let startTime: number, endTime: number;

  if (isTransactionNode(node)) {
    startTime = node.value.start_timestamp;
    endTime = node.value.timestamp;
  } else if (isSpanNode(node)) {
    startTime = node.value.start_timestamp;
    endTime = node.value.timestamp;
  } else if (isEAPSpanNode(node)) {
    startTime = node.value.start_timestamp;
    endTime = node.value.end_timestamp;
  } else {
    return {leftPercent: 0, widthPercent: 0};
  }

  if (traceBounds.duration === 0) return {leftPercent: 0, widthPercent: 0};

  const relativeStart =
    Math.max(0, (startTime - traceBounds.startTime) / traceBounds.duration) * 100;
  const spanDuration = ((endTime - startTime) / traceBounds.duration) * 100;

  // Minimum width of 2% for very short spans
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
    title: 'Unknown',
    subtitle: '',
    color: colors[1],
  };

  if (isTransactionNode(node)) {
    nodeInfo.title = node.value.transaction || 'Transaction';
    nodeInfo.subtitle = node.value['transaction.op'] || '';
    return nodeInfo;
  }

  if (!isEAPSpanNode(node) && !isSpanNode(node)) {
    return nodeInfo;
  }

  const getNodeAttribute = (key: string) => {
    if (isEAPSpanNode(node)) {
      return node.value.additional_attributes?.[key];
    }

    return node.value?.data?.[key];
  };

  const op =
    (isTransactionNode(node) ? node.value?.['transaction.op'] : node.value?.op) ??
    'default';
  const truncatedOp = op.startsWith('gen_ai.') ? op.slice(7) : op;
  nodeInfo.title = truncatedOp;

  if (getIsAiRunSpan({op})) {
    const agentName = getNodeAttribute('gen_ai.agent.name') || '';
    const model =
      getNodeAttribute('gen_ai.request.model') ||
      getNodeAttribute('gen_ai.response.model') ||
      '';
    nodeInfo.icon = <IconBot size="md" />;
    nodeInfo.subtitle = agentName;
    if (model) {
      nodeInfo.subtitle = nodeInfo.subtitle ? (
        <Fragment>
          {nodeInfo.subtitle} ({model})
        </Fragment>
      ) : (
        model
      );
    }
    nodeInfo.color = colors[0];
  } else if (getIsAiGenerationSpan({op})) {
    const tokens = getNodeAttribute('gen_ai.usage.total_tokens');
    const cost = getNodeAttribute('gen_ai.usage.total_cost');
    nodeInfo.icon = <IconSpeechBubble size="md" />;
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
  } else if (op === 'gen_ai.execute_tool') {
    nodeInfo.icon = <IconTool size="md" />;
    nodeInfo.subtitle = getNodeAttribute('gen_ai.tool.name') || '';
    nodeInfo.color = colors[5];
  } else if (op === 'gen_ai.handoff') {
    nodeInfo.icon = <IconChevron size="md" isDouble direction="right" />;
    nodeInfo.subtitle = node.value.description || '';
    nodeInfo.color = colors[4];
  } else {
    nodeInfo.subtitle = node.value.description || '';
  }

  // Override the color and icon if the node has errors
  if (hasError(node)) {
    nodeInfo.icon = <IconFire size="md" color="red300" />;
    nodeInfo.color = colors[6];
  }

  return nodeInfo;
}

function hasError(node: AITraceSpanNode) {
  if (node.errors.size > 0) {
    return true;
  }

  // spans with status unknown are errors
  if (isEAPSpanNode(node)) {
    return node.value.additional_attributes?.['span.status'] === 'unknown';
  }

  return false;
}

const TraceListContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  padding: ${space(0.25)};
  overflow: hidden;
`;

const ListItemContainer = styled('div')<{
  hasErrors: boolean;
  indent: number;
  isSelected: boolean;
}>`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(0.5)};
  padding-left: ${p => (p.indent ? p.indent * 16 : 4)}px;
  border-radius: ${p => p.theme.borderRadius};
  cursor: pointer;
  background-color: ${p =>
    p.isSelected ? p.theme.backgroundSecondary : p.theme.background};
  outline: ${p =>
    p.isSelected
      ? p.hasErrors
        ? `2px solid ${p.theme.red200}`
        : `2px solid ${p.theme.purple200}`
      : 'none'};

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const ListItemIcon = styled('div')<{color: string}>`
  display: flex;
  align-items: center;
  margin-right: ${space(1)};
  color: ${p => p.color};
`;

const ListItemContent = styled('div')`
  flex: 1;
  min-width: 0;
`;

const ListItemHeader = styled(Flex)`
  margin-bottom: ${space(0.5)};
`;

const ListItemTitle = styled('div')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.textColor};
  white-space: nowrap;
  flex-basis: max-content;
  flex-shrink: 0;
`;

const ListItemSubtitle = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  flex-basis: max-content;
`;

const DurationBar = styled('div')<{
  color: string;
  relativeTiming: {leftPercent: number; widthPercent: number};
}>`
  width: 100%;
  height: 4px;
  background-color: ${p => p.theme.gray200};
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

const DurationText = styled('div')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.subText};
`;

const TransactionItem = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  padding: ${space(2)} ${space(0.5)} 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  min-width: 0;
  &:first-child {
    padding-top: 0;
  }
`;

const FlexSpacer = styled('div')`
  flex-grow: 1;
  min-width: 0;
  flex-basis: 0;
`;
