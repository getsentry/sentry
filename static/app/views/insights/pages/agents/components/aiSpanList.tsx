import {Fragment, memo, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {IconChat, IconChevron, IconCode, IconFire, IconFix} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import getDuration from 'sentry/utils/duration/getDuration';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {getIsAiRunNode} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {getNodeId} from 'sentry/views/insights/pages/agents/utils/getNodeId';
import {
  getIsAiCreateAgentSpan,
  getIsAiGenerationSpan,
  getIsAiRunSpan,
  getIsExecuteToolSpan,
  getIsHandoffSpan,
} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
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
  const nodesByTransaction = useMemo(() => {
    const result: Map<
      TraceTreeNode<TraceTree.Transaction | TraceTree.EAPSpan>,
      AITraceSpanNode[]
    > = new Map();
    for (const node of nodes) {
      const transaction = getClosestNode(node, isTransactionNodeEquivalent);
      if (!transaction) {
        continue;
      }
      const transactionNodes = result.get(transaction) || [];
      result.set(transaction, [...transactionNodes, node]);
    }
    return result;
  }, [nodes]);

  return (
    <TraceListContainer>
      {nodesByTransaction.entries().map(([transaction, transactionNodes]) => (
        <Fragment key={getNodeId(transaction)}>
          <TransactionWrapper
            canCollapse={nodesByTransaction.size > 1}
            transaction={transaction}
            nodes={transactionNodes}
            onSelectNode={onSelectNode}
            selectedNodeKey={selectedNodeKey}
          />
        </Fragment>
      ))}
    </TraceListContainer>
  );
}

function TransactionWrapper({
  canCollapse,
  nodes,
  onSelectNode,
  selectedNodeKey,
  transaction,
}: {
  canCollapse: boolean;
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeKey: string | null;
  transaction: TraceTreeNode<TraceTree.Transaction | TraceTree.EAPSpan>;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const theme = useTheme();
  const colors = [...theme.chart.getColorPalette(5), theme.red300];
  const timeBounds = getNodeTimeBounds(nodes);

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

  const handleCollapse = () => {
    setIsExpanded(prevValue => !prevValue);
  };

  return (
    <Fragment>
      <TransactionButton type="button" disabled={!canCollapse} onClick={handleCollapse}>
        {canCollapse ? (
          <StyledIconChevron direction={isExpanded ? 'down' : 'right'} />
        ) : null}
        <Tooltip
          title={transaction.value.transaction}
          showOnlyOnOverflow
          skipWrapper
          delay={500}
        >
          <span>{transaction.value.transaction}</span>
        </Tooltip>
      </TransactionButton>
      {isExpanded &&
        nodes.map(node => {
          const aiRunNode = nodeAiRunParentsMap[getNodeId(node)];

          // Only indent if the node is not the ai run node
          const shouldIndent = aiRunNode && aiRunNode !== node;

          const uniqueKey = getNodeId(node);
          return (
            <TraceListItem
              indent={shouldIndent ? 1 : 0}
              traceBounds={timeBounds}
              key={uniqueKey}
              node={node}
              onClick={() => onSelectNode(node)}
              isSelected={uniqueKey === selectedNodeKey}
              colors={colors}
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

  if (getIsAiRunSpan({op}) || getIsAiCreateAgentSpan({op})) {
    const agentName =
      getNodeAttribute(SpanFields.GEN_AI_AGENT_NAME) ||
      getNodeAttribute(SpanFields.GEN_AI_FUNCTION_ID) ||
      '';
    const model =
      getNodeAttribute(SpanFields.GEN_AI_REQUEST_MODEL) ||
      getNodeAttribute(SpanFields.GEN_AI_RESPONSE_MODEL) ||
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
  } else if (getIsAiGenerationSpan({op})) {
    const tokens = getNodeAttribute(SpanFields.GEN_AI_USAGE_TOTAL_TOKENS);
    const cost = getNodeAttribute(SpanFields.GEN_AI_USAGE_TOTAL_COST);
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
  } else if (getIsExecuteToolSpan({op})) {
    const toolName = getNodeAttribute(SpanFields.GEN_AI_TOOL_NAME);
    nodeInfo.icon = <IconFix size="md" />;
    nodeInfo.title = toolName || truncatedOp;
    nodeInfo.subtitle = toolName ? truncatedOp : '';
    nodeInfo.color = colors[5];
  } else if (getIsHandoffSpan({op})) {
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

  if (isEAPSpanNode(node)) {
    const spanStatus = node.value.additional_attributes?.[SpanFields.SPAN_STATUS];
    if (!!spanStatus && typeof spanStatus === 'string') {
      return spanStatus.includes('error');
    }
    const status = node.value.additional_attributes?.status;
    if (!!status && typeof status === 'string') {
      return status.includes('error');
    }

    return false;
  }

  return false;
}

const TraceListContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space['2xs']};
  overflow: hidden;
`;

const ListItemContainer = styled('div')<{
  hasErrors: boolean;
  indent: number;
  isSelected: boolean;
}>`
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xs};
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
  margin-right: ${p => p.theme.space.md};
  color: ${p => p.color};
`;

const ListItemContent = styled('div')`
  flex: 1;
  min-width: 0;
`;

const ListItemHeader = styled(Flex)`
  margin-bottom: ${p => p.theme.space.xs};
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

const TransactionButton = styled('button')`
  position: relative;
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.sm};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  margin-top: ${p => p.theme.space.md};
  gap: ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.borderRadius};
  background: transparent;
  border: none;
  outline: none;
  justify-content: flex-start;
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};

  &:hover:not(:disabled) {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  &:first-child {
    margin-top: 0;
  }

  & > span {
    ${p => p.theme.overflowEllipsis};
    flex: 1;
    min-width: 0;
    text-align: left;
  }
`;

const StyledIconChevron = styled(IconChevron)`
  flex-shrink: 0;
`;

const FlexSpacer = styled('div')`
  flex-grow: 1;
  min-width: 0;
  flex-basis: 0;
`;
