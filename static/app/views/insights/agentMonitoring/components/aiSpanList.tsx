import {Fragment, memo, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import Count from 'sentry/components/count';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron, IconCode, IconFire} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {IconSpeechBubble} from 'sentry/icons/iconSpeechBubble';
import {IconTool} from 'sentry/icons/iconTool';
import {space} from 'sentry/styles/space';
import getDuration from 'sentry/utils/duration/getDuration';
import {LLMCosts} from 'sentry/views/insights/agentMonitoring/components/llmCosts';
import {getNodeId} from 'sentry/views/insights/agentMonitoring/utils/getNodeId';
import {getIsAiRunNode} from 'sentry/views/insights/agentMonitoring/utils/highlightedSpanAttributes';
import {
  AI_AGENT_NAME_ATTRIBUTE,
  AI_COST_ATTRIBUTE,
  AI_MODEL_ID_ATTRIBUTE,
  AI_MODEL_NAME_FALLBACK_ATTRIBUTE,
  AI_TOOL_NAME_ATTRIBUTE,
  AI_TOTAL_TOKENS_ATTRIBUTE,
  getIsAiGenerationSpan,
  getIsAiHandoffSpan,
  getIsAiRunSpan,
  getIsAiToolCallSpan,
} from 'sentry/views/insights/agentMonitoring/utils/query';
import {Referrer} from 'sentry/views/insights/agentMonitoring/utils/referrers';
import type {AITraceSpanNode} from 'sentry/views/insights/agentMonitoring/utils/types';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNode,
  isTransactionNodeEquivalent,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

function getTimeBounds(transactionNode: AITraceSpanNode | null) {
  if (!transactionNode?.value) return {startTime: 0, endTime: 0, duration: 0};

  const startTime = transactionNode.value.start_timestamp;
  let endTime = 0;
  if (isTransactionNode(transactionNode) || isSpanNode(transactionNode)) {
    endTime = transactionNode.value.timestamp;
  } else if (isEAPSpanNode(transactionNode)) {
    endTime = transactionNode.value.end_timestamp;
  }

  if (endTime === 0) return {startTime: 0, endTime: 0, duration: 0};

  return {
    startTime,
    endTime,
    duration: endTime - startTime,
  };
}

function getClosestAiRunNode<T extends AITraceSpanNode>(
  node: AITraceSpanNode,
  predicate: (node: TraceTreeNode) => node is T
): T {
  if (predicate(node)) {
    return node;
  }
  return TraceTree.ParentNode(node, predicate) as T;
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

  const spanAttributesRequest = useEAPSpanAttributes(nodes);
  let currentTransaction: TraceTreeNode<
    TraceTree.Transaction | TraceTree.EAPSpan
  > | null = null;
  let currentAiRunNode: AITraceSpanNode | null = null;

  return (
    <TraceListContainer>
      {nodes.map(node => {
        // find the closest transaction node
        const transactionNode = getClosestAiRunNode(node, isTransactionNodeEquivalent);
        const aiRunNode = getClosestAiRunNode(node, getIsAiRunNode);

        if (aiRunNode !== currentAiRunNode) {
          currentAiRunNode = aiRunNode;
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
              traceBounds={getTimeBounds(currentAiRunNode)}
              key={uniqueKey}
              node={node}
              onClick={() => onSelectNode(node)}
              isSelected={uniqueKey === selectedNodeKey}
              colors={colors}
              isLoadingAttributes={
                isEAPSpanNode(node) ? spanAttributesRequest.isPending : false
              }
              spanAttributes={
                isEAPSpanNode(node)
                  ? spanAttributesRequest.data[node.value.event_id]
                  : undefined
              }
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
  spanAttributes = {},
  isLoadingAttributes = false,
  traceBounds,
  indent,
}: {
  colors: readonly string[];
  indent: number;
  isSelected: boolean;
  node: AITraceSpanNode;
  onClick: () => void;
  spanAttributes: Record<string, string | number> | undefined;
  traceBounds: TraceBounds;
  isLoadingAttributes?: boolean;
}) {
  const {icon, title, subtitle, color} = getNodeInfo(node, colors, spanAttributes);
  const safeColor = color || colors[0] || '#9ca3af';
  const relativeTiming = calculateRelativeTiming(node, traceBounds);
  const duration = getTimeBounds(node).duration;

  return (
    <ListItemContainer
      hasErrors={node.errors.size > 0}
      isSelected={isSelected}
      onClick={onClick}
      indent={indent}
    >
      <ListItemIcon color={safeColor}>{icon} </ListItemIcon>
      <ListItemContent>
        <ListItemHeader align="center" gap={space(0.5)}>
          <ListItemTitle>{title}</ListItemTitle>
          {isLoadingAttributes ? (
            <Placeholder height="12px" width="60px" />
          ) : (
            subtitle && <ListItemSubtitle>- {subtitle}</ListItemSubtitle>
          )}
          <FlexSpacer />
          <DurationText>{getDuration(duration, 2, true, true)}</DurationText>
        </ListItemHeader>
        <DurationBar color={safeColor} relativeTiming={relativeTiming} />
      </ListItemContent>
    </ListItemContainer>
  );
});

function useEAPSpanAttributes(nodes: Array<TraceTreeNode<TraceTree.NodeValue>>) {
  const spans = useMemo(() => {
    return nodes.filter(node => isEAPSpanNode(node));
  }, [nodes]);
  const projectIds = new Set(spans.map(span => span.value.project_id));
  const totalStart = Math.min(
    ...spans.map(span => new Date(span.value.start_timestamp * 1000).getTime())
  );
  const totalEnd = Math.max(
    ...spans.map(span => new Date(span.value.end_timestamp * 1000).getTime())
  );

  const spanAttributesRequest = useEAPSpans(
    {
      search: `span_id:[${spans.map(span => `"${span.value.event_id}"`).join(',')}]`,
      fields: [
        'span_id',
        AI_AGENT_NAME_ATTRIBUTE,
        AI_MODEL_ID_ATTRIBUTE,
        AI_MODEL_NAME_FALLBACK_ATTRIBUTE,
        AI_TOTAL_TOKENS_ATTRIBUTE,
        AI_COST_ATTRIBUTE,
        AI_TOOL_NAME_ATTRIBUTE,
      ],
      limit: 100,
      // Pass custom values as the page filters are not available in the trace view
      pageFilters: {
        projects: Array.from(projectIds),
        environments: [],
        datetime: {
          period: null,
          start: new Date(totalStart),
          end: new Date(totalEnd),
          utc: true,
        },
      },
    },
    Referrer.TRACE_DRAWER
  );

  const spanAttributes = useMemo(() => {
    return spanAttributesRequest.data?.reduce(
      (acc, span) => {
        acc[span.span_id] = span;
        return acc;
      },
      {} as Record<string, Record<string, string | number>>
    );
  }, [spanAttributesRequest.data]);

  return {data: spanAttributes, isPending: spanAttributesRequest.isPending};
}

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

// TODO: consider splitting this up
function getNodeInfo(
  node: AITraceSpanNode,
  colors: readonly string[],
  spanAttributes: Record<string, string | number>
) {
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
      return spanAttributes?.[key];
    }

    return node.value?.data?.[key];
  };

  const op =
    (isTransactionNode(node) ? node.value?.['transaction.op'] : node.value?.op) ??
    'default';
  const truncatedOp = op.startsWith('gen_ai.') ? op.slice(7) : op;
  nodeInfo.title = truncatedOp;

  if (getIsAiRunSpan({op})) {
    const agentName = getNodeAttribute(AI_AGENT_NAME_ATTRIBUTE) || '';
    const model =
      getNodeAttribute(AI_MODEL_ID_ATTRIBUTE) ||
      getNodeAttribute(AI_MODEL_NAME_FALLBACK_ATTRIBUTE) ||
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
    const tokens = getNodeAttribute(AI_TOTAL_TOKENS_ATTRIBUTE);
    const cost = getNodeAttribute(AI_COST_ATTRIBUTE);
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
  } else if (getIsAiToolCallSpan({op})) {
    nodeInfo.icon = <IconTool size="md" />;
    nodeInfo.subtitle = getNodeAttribute(AI_TOOL_NAME_ATTRIBUTE) || '';
    nodeInfo.color = colors[5];
  } else if (getIsAiHandoffSpan({op})) {
    nodeInfo.icon = <IconChevron size="md" isDouble direction="right" />;
    nodeInfo.subtitle = node.value.description || '';
    nodeInfo.color = colors[4];
  } else {
    nodeInfo.subtitle = node.value.description || '';
  }

  // Override the color and icon if the node has errors
  if (node.errors.size > 0) {
    nodeInfo.icon = <IconFire size="md" color="red300" />;
    nodeInfo.color = colors[6];
  }

  return nodeInfo;
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
