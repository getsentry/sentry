import {Fragment, memo, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {IconChat, IconChevron, IconCode, IconFire, IconFix} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {t} from 'sentry/locale';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {
  getFirstToolInputValue,
  getGenAiOpType,
  getIsAiAgentNode,
  getNumberAttr,
  getStringAttr,
  hasError,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  calculateRelativeTiming,
  getCompressedTimeBounds,
  getNodeTimeBounds,
  type TraceBounds,
} from 'sentry/views/insights/pages/agents/utils/aiTraceTiming';
import {GenAiOperationType} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {
  isEAPSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import type {TransactionNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/transactionNode';

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
    const result = new Map<
      TransactionNode | EapSpanNode | AITraceSpanNode,
      AITraceSpanNode[]
    >();
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
        : (node as AITraceSpanNode).findParent(p => getIsAiAgentNode(p));
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
          <Tooltip title={title} showOnlyOnOverflow skipWrapper>
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
  traceBounds,
  indent,
  compressedStartByNodeId,
}: {
  indent: number;
  isSelected: boolean;
  node: AITraceSpanNode;
  onClick: () => void;
  traceBounds: TraceBounds;
  compressedStartByNodeId?: Map<string, number>;
}) {
  const theme = useTheme();
  const hasErrors = hasError(node);
  const colorByOpType = useMemo(() => {
    const palette = theme.tokens.dataviz.categorical[5];
    return {
      [GenAiOperationType.AGENT]: palette[0],
      [GenAiOperationType.AI_CLIENT]: palette[2],
      [GenAiOperationType.HANDOFF]: palette[4],
      [GenAiOperationType.TOOL]: palette[5],
      default: palette[1],
      error: theme.tokens.graphics.danger.vibrant,
    };
  }, [theme]);
  const {icon, title, subtitle, color} = getSpanPresentation(node, colorByOpType);
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
      <Flex align="center" position="relative" style={{color}}>
        {icon}
        {hasErrors && (
          <Tooltip delay={300} title={t('This span encountered an error')} skipWrapper>
            <Container
              position="absolute"
              radius="full"
              style={{bottom: -6, right: -6, padding: 1, background: 'var(--row-bg)'}}
            >
              <IconFire display="block" size="xs" variant="danger" />
            </Container>
          </Tooltip>
        )}
      </Flex>
      <Stack gap="xs" flex="1" minWidth="0">
        <Flex align="center" gap="xs">
          <Container maxWidth="40%" flexShrink={0}>
            <Tooltip title={title} showOnlyOnOverflow skipWrapper>
              <Text bold size="sm" ellipsis>
                {title}
              </Text>
            </Tooltip>
          </Container>
          {subtitle && (
            <Tooltip title={subtitle} showOnlyOnOverflow skipWrapper maxWidth={500}>
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
        <DurationBar color={color} relativeTiming={relativeTiming} />
      </Stack>
    </ListItemContainer>
  );
});

interface SpanPresentation {
  color: string;
  icon: React.ReactNode;
  subtitle: React.ReactNode;
  title: React.ReactNode;
}

type ColorByOpType = Record<GenAiOperationType | 'default' | 'error', string>;

function getColor(node: AITraceSpanNode, colorByOpType: ColorByOpType): string {
  if (hasError(node)) {
    return colorByOpType.error;
  }
  const opType = getGenAiOpType(node);
  return colorByOpType[opType as GenAiOperationType] ?? colorByOpType.default;
}

function getSpanPresentation(
  node: AITraceSpanNode,
  colorByOpType: ColorByOpType
): SpanPresentation {
  const rawOp = node.op ?? 'default';
  const op = rawOp.startsWith('gen_ai.') ? rawOp.slice(7) : rawOp;
  const genAiOpType = getGenAiOpType(node);

  const rawDesc = node.description || ('name' in node.value ? node.value.name : '');
  const description = rawDesc.startsWith('gen_ai.') ? rawDesc.slice(7) : rawDesc;

  const color = getColor(node, colorByOpType);

  switch (genAiOpType) {
    case GenAiOperationType.AGENT: {
      const name =
        getStringAttr(node, SpanFields.GEN_AI_AGENT_NAME) ||
        getStringAttr(node, SpanFields.GEN_AI_FUNCTION_ID) ||
        '';
      const model =
        getStringAttr(node, SpanFields.GEN_AI_REQUEST_MODEL) ||
        getStringAttr(node, SpanFields.GEN_AI_RESPONSE_MODEL) ||
        '';
      return {
        icon: <IconBot size="md" />,
        color,
        title: name || op,
        subtitle: model ? (
          <Fragment>
            {op} ({model})
          </Fragment>
        ) : (
          op
        ),
      };
    }
    case GenAiOperationType.AI_CLIENT: {
      const tokens = getNumberAttr(node, SpanFields.GEN_AI_USAGE_TOTAL_TOKENS);
      const cost = getNumberAttr(node, SpanFields.GEN_AI_COST_TOTAL_TOKENS);
      const responseModel = getStringAttr(node, SpanFields.GEN_AI_RESPONSE_MODEL);
      const tokenLabel = tokens ? (
        <Fragment>
          <Count value={tokens} />
          {' Tokens'}
        </Fragment>
      ) : null;
      return {
        icon: <IconChat size="md" />,
        color,
        title: responseModel || description || op,
        subtitle:
          tokenLabel && cost ? (
            <Fragment>
              {tokenLabel} ({<LLMCosts cost={cost} />})
            </Fragment>
          ) : (
            (tokenLabel ?? '')
          ),
      };
    }
    case GenAiOperationType.TOOL: {
      const toolName = getStringAttr(node, SpanFields.GEN_AI_TOOL_NAME);
      const firstInputValue = getFirstToolInputValue(node);
      return {
        icon: <IconFix size="md" />,
        color,
        title: toolName || op,
        subtitle: firstInputValue || (toolName ? op : ''),
      };
    }
    case GenAiOperationType.HANDOFF:
      return {
        icon: <IconChevron size="md" isDouble direction="right" />,
        color,
        title: op,
        subtitle: description || '',
      };
    default:
      return {
        icon: <IconCode size="md" />,
        color,
        title: op,
        subtitle: description || '',
      };
  }
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
  --row-bg: ${p =>
    p.isSelected
      ? p.theme.tokens.background.secondary
      : p.theme.tokens.background.primary};
  background-color: var(--row-bg);
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
  font-size: ${p => p.theme.font.size.sm};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  margin-top: ${p => p.theme.space.md};
  gap: ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.radius.md};
  background: transparent;
  border: none;
  outline: none;
  justify-content: flex-start;
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.font.weight.sans.regular};

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
