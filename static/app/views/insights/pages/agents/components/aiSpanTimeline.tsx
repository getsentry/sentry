import {Fragment, memo, useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {getDuration} from '@sentry/scraps/duration';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {stripAnnotations} from '@sentry/scraps/markdown/annotation';
import {Text} from '@sentry/scraps/text';

import {Count} from 'sentry/components/count';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {
  type AiSpanTree,
  type AiSpanTreeNode,
  buildAiSpanTree,
  getDefaultExpanded,
  getTreeAncestors,
  getVisibleTreeNodes,
} from 'sentry/views/insights/pages/agents/utils/aiSpanTree';
import {
  type ColorByOpType,
  getToolInputPreview,
  getGenAiOpType,
  getNumberAttr,
  getSpanColor,
  getStringAttr,
  getTimelineColorByOpType,
  hasError,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  getEvaluationPreview,
  getNodeEvaluation,
} from 'sentry/views/insights/pages/agents/utils/evaluation';
import {
  getExtractionPreview,
  getNodeExtraction,
} from 'sentry/views/insights/pages/agents/utils/extraction';
import {getToolOutputBytes} from 'sentry/views/insights/pages/agents/utils/getToolOutputBytes';
import {
  getMemoryPreview,
  getNodeMemory,
} from 'sentry/views/insights/pages/agents/utils/memory';
import {GenAiOperationType} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

import {
  calculateRelativeTiming,
  getCompressedTimeBounds,
  getNodeTimeBounds,
  type TraceBounds,
} from './aiSpanList';
import {AiSpanStatusIcon} from './aiSpanStatusIcon';
import {LLMCosts} from './llmCosts';
import {ScrubbedText} from './scrubbedText';

interface SpanPresentation {
  color: string;
  isTool: boolean;
  secondary: string;
  title: string;
}

const INDENT_PX = 16;

export function AiSpanTimeline({
  nodes,
  selectedNodeKey,
  onSelectNode,
  compressGaps = false,
  isLoading = false,
  maxDefaultDepth = Infinity,
  visibleNodeIds,
}: {
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeKey: string | null;
  compressGaps?: boolean;
  isLoading?: boolean;
  /**
   * Spans shallower than this start expanded, like `StructuredEventData`'s
   * `maxDefaultDepth`. Everything starts expanded by default. The selected span's
   * ancestors are always expanded so it stays visible.
   */
  maxDefaultDepth?: number;
  /**
   * Only shows these spans, e.g. a window around one step. Nesting still comes
   * from all `nodes`, so the rows keep their depth.
   */
  visibleNodeIds?: ReadonlySet<string>;
}) {
  const compressedBounds = useMemo(
    () => (compressGaps ? getCompressedTimeBounds(nodes) : null),
    [compressGaps, nodes]
  );
  const timeBounds = useMemo(
    () => compressedBounds ?? getNodeTimeBounds(nodes),
    [compressedBounds, nodes]
  );

  const tree = useMemo(() => buildAiSpanTree(nodes), [nodes]);
  const {isExpanded, toggleExpanded} = useExpandedState(
    tree,
    maxDefaultDepth,
    selectedNodeKey
  );

  const isInWindow = useCallback(
    (treeNode: AiSpanTreeNode) => !visibleNodeIds || visibleNodeIds.has(treeNode.node.id),
    [visibleNodeIds]
  );
  const rows = useMemo(
    () => getVisibleTreeNodes(tree, isExpanded).filter(isInWindow),
    [tree, isExpanded, isInWindow]
  );
  const hasNesting = useMemo(
    () => tree.list.some(treeNode => treeNode.children.length > 0),
    [tree]
  );

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  return (
    <Stack gap="xs">
      {rows.map(treeNode => {
        const node = treeNode.node;
        const canToggle = treeNode.children.some(isInWindow);
        return (
          <TimelineRow
            key={node.id}
            node={node}
            depth={treeNode.depth}
            hasToggleColumn={hasNesting}
            canToggle={canToggle}
            isExpanded={canToggle && isExpanded(treeNode)}
            onToggleExpanded={toggleExpanded}
            traceBounds={timeBounds}
            onSelectNode={onSelectNode}
            isSelected={node.id === selectedNodeKey}
            compressedStartByNodeId={compressedBounds?.compressedStartByNodeId}
          />
        );
      })}
    </Stack>
  );
}

/**
 * Tracks the spans the user expanded or collapsed. The rest follow
 * `maxDefaultDepth`, so spans loaded later (e.g. the conversation's next page)
 * start in their default state, and children loaded under a collapsed span stay
 * hidden.
 */
function useExpandedState(
  tree: AiSpanTree,
  maxDefaultDepth: number,
  selectedNodeKey: string | null
) {
  const [expandedById, setExpandedById] = useState<ReadonlyMap<string, boolean>>(
    () => new Map()
  );

  // Reveals the selected span once it's in the tree, e.g. a span from the URL that
  // loads with a later page. Done while rendering so it never flashes collapsed.
  // Keyed by ID, so a reload of the tree doesn't undo the user collapsing it again.
  const selectedTreeNode = selectedNodeKey ? tree.byId.get(selectedNodeKey) : undefined;
  const revealNodeId = selectedTreeNode?.node.id ?? null;
  const [revealedNodeId, setRevealedNodeId] = useState<string | null>(null);
  if (revealNodeId !== revealedNodeId) {
    setRevealedNodeId(revealNodeId);
    if (selectedTreeNode) {
      setExpandedById(previous => {
        const next = new Map(previous);
        for (const ancestor of getTreeAncestors(selectedTreeNode)) {
          next.set(ancestor.node.id, true);
        }
        return next;
      });
    }
  }

  const isExpandedByDefault = useMemo(
    () => getDefaultExpanded(maxDefaultDepth),
    [maxDefaultDepth]
  );
  const isExpanded = useCallback(
    (treeNode: AiSpanTreeNode) =>
      expandedById.get(treeNode.node.id) ?? isExpandedByDefault(treeNode),
    [expandedById, isExpandedByDefault]
  );

  const toggleExpanded = useCallback(
    (nodeId: string, expanded: boolean) =>
      setExpandedById(previous => new Map(previous).set(nodeId, expanded)),
    []
  );

  return {isExpanded, toggleExpanded};
}

const TIMELINE_SKELETON_ROWS: Array<{
  title: string;
  indent?: boolean;
  secondary?: string;
}> = [
  {title: '28%', secondary: '13%'},
  {title: '26%', secondary: '12%', indent: true},
  {title: '32%', indent: true},
  {title: '24%', secondary: '20%', indent: true},
  {title: '30%', secondary: '11%', indent: true},
  {title: '33%', indent: true},
  {title: '31%', secondary: '14%'},
  {title: '28%', secondary: '15%', indent: true},
];

function TimelineSkeleton() {
  return (
    <Stack gap="xs">
      {TIMELINE_SKELETON_ROWS.map((row, index) => (
        <Container
          key={`${row.title}-${index}`}
          padding="xs"
          paddingLeft={row.indent ? 'xl' : 'xs'}
        >
          <Stack gap="xs">
            <Flex align="center" gap="md">
              <Placeholder height="16px" width="16px" />
              <Placeholder height="14px" width={row.title} />
              {row.secondary ? <Placeholder height="14px" width={row.secondary} /> : null}
              <Flex flex="1" minWidth="0" />
              <Flex flexShrink={0} width="64px" justify="end">
                <Placeholder height="14px" width="44px" />
              </Flex>
              <Flex flexShrink={0} width="44px" justify="end">
                <Placeholder height="14px" width="36px" />
              </Flex>
            </Flex>
            <Placeholder height="4px" width="100%" />
          </Stack>
        </Container>
      ))}
    </Stack>
  );
}

const TimelineRow = memo(function TimelineRowImpl({
  node,
  onSelectNode,
  isSelected,
  depth,
  hasToggleColumn,
  canToggle,
  isExpanded,
  onToggleExpanded,
  traceBounds,
  compressedStartByNodeId,
}: {
  canToggle: boolean;
  depth: number;
  hasToggleColumn: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  node: AITraceSpanNode;
  onSelectNode: (node: AITraceSpanNode) => void;
  onToggleExpanded: (nodeId: string, expanded: boolean) => void;
  traceBounds: TraceBounds;
  compressedStartByNodeId?: Map<string, number>;
}) {
  const theme = useTheme();
  const hasErrors = hasError(node);
  const colorByOpType = useMemo(() => getTimelineColorByOpType(theme), [theme]);

  const {title, secondary, isTool, color} = getSpanPresentation(node, colorByOpType);
  const relativeTiming = calculateRelativeTiming(
    node,
    traceBounds,
    compressedStartByNodeId
  );
  const metric = getMetric(node);
  const duration = getNodeTimeBounds(node).duration;

  return (
    <RowContainer data-selected={isSelected} depth={depth}>
      {hasToggleColumn ? (
        // Rows without children keep the space, so siblings line up whether or not
        // they can be expanded. The gutter keeps the button's focus ring inside the
        // row's background.
        <Flex
          alignSelf="start"
          flexShrink={0}
          width="28px"
          paddingLeft="xs"
          paddingTop="2xs"
        >
          {canToggle ? (
            <Button
              size="zero"
              variant="transparent"
              aria-label={isExpanded ? t('Collapse') : t('Expand')}
              aria-expanded={isExpanded}
              icon={
                <IconChevron
                  direction={isExpanded ? 'down' : 'right'}
                  size="sm"
                  variant="muted"
                />
              }
              onClick={() => onToggleExpanded(node.id, !isExpanded)}
            />
          ) : null}
        </Flex>
      ) : null}
      <Flex align="center" flex="1" minWidth="0">
        {flexProps => (
          <SelectButton type="button" {...flexProps} onClick={() => onSelectNode(node)}>
            <Stack gap="xs" flex="1" minWidth="0">
              <Flex align="center" gap="md" marginBottom={hasErrors ? 'sm' : undefined}>
                <AiSpanStatusIcon node={node} />
                {isTool ? (
                  <Flex minWidth="0" maxWidth="50%">
                    <EllipsisTag
                      variant={hasErrors ? 'danger' : isSelected ? 'info' : 'muted'}
                    >
                      {title}
                    </EllipsisTag>
                  </Flex>
                ) : (
                  <Container maxWidth="50%" minWidth="0">
                    <InfoText
                      title={title}
                      mode="overflowOnly"
                      size="sm"
                      variant="primary"
                      bold
                    >
                      {title}
                    </InfoText>
                  </Container>
                )}
                <Flex flex="1" minWidth="0">
                  {secondary && (
                    <InfoText
                      title={stripAnnotations(secondary)}
                      mode="overflowOnly"
                      maxWidth={500}
                      size="sm"
                      variant="muted"
                    >
                      {/* Tool input previews mark scrubbed values in the conversation view. */}
                      <ScrubbedText>{secondary}</ScrubbedText>
                    </InfoText>
                  )}
                </Flex>
                <Flex align="center" justify="end" flexShrink={0} gap="xs">
                  {metric ? (
                    <Text
                      size="sm"
                      variant={isSelected ? 'primary' : 'muted'}
                      align="right"
                      tabular
                    >
                      {metric}
                    </Text>
                  ) : isTool ? (
                    <ToolOutputSizeMetric node={node} isSelected={isSelected} />
                  ) : null}
                  {metric || isTool ? (
                    <Text size="sm" variant={isSelected ? 'primary' : 'muted'}>
                      •
                    </Text>
                  ) : null}
                  <Text
                    size="sm"
                    variant={isSelected ? 'primary' : 'muted'}
                    align="right"
                    tabular
                  >
                    {getDuration(duration, {precision: 2, style: 'narrow'})}
                  </Text>
                </Flex>
              </Flex>
              <TimelineBar color={color} relativeTiming={relativeTiming} />
            </Stack>
          </SelectButton>
        )}
      </Flex>
    </RowContainer>
  );
});

/**
 * Builds the tokens/cost metric column content.
 * Shown for any span that reports tokens and/or cost (e.g. `1.5k/$1.00`).
 */
function getMetric(node: AITraceSpanNode): React.ReactNode {
  const tokens = getNumberAttr(node, SpanFields.GEN_AI_USAGE_TOTAL_TOKENS);
  const cost = getNumberAttr(node, SpanFields.GEN_AI_COST_TOTAL_TOKENS);

  if (tokens && cost) {
    return (
      <Fragment>
        <Count value={tokens} />/<LLMCosts cost={cost} />
      </Fragment>
    );
  }
  if (tokens) {
    return <Count value={tokens} />;
  }
  if (cost) {
    return <LLMCosts cost={cost} />;
  }
  return null;
}

/**
 * Tool-call spans don't report token usage, so we show their output size
 * (e.g. `4.1 KB`) instead, derived from the tool result on the span.
 */
function ToolOutputSizeMetric({
  node,
  isSelected,
}: {
  isSelected: boolean;
  node: AITraceSpanNode;
}) {
  const bytes = getToolOutputBytes(node);

  return (
    <Text size="sm" variant={isSelected ? 'primary' : 'muted'} align="right" tabular>
      {formatBytesBase10(bytes)}
    </Text>
  );
}

function getSpanPresentation(
  node: AITraceSpanNode,
  colorByOpType: ColorByOpType
): SpanPresentation {
  const rawOp = node.op ?? 'default';
  const op = rawOp.startsWith('gen_ai.') ? rawOp.slice(7) : rawOp;
  const genAiOpType = getGenAiOpType(node);

  const rawDesc =
    node.description || (node.value && 'name' in node.value ? node.value.name : '');
  const description = rawDesc.startsWith('gen_ai.') ? rawDesc.slice(7) : rawDesc;

  const color = getSpanColor(node, colorByOpType);

  const evaluation = getNodeEvaluation(node);
  if (evaluation) {
    return {
      color,
      isTool: false,
      title:
        getStringAttr(node, SpanFields.GEN_AI_REQUEST_MODEL) ||
        getStringAttr(node, SpanFields.GEN_AI_RESPONSE_MODEL) ||
        op,
      secondary: getEvaluationPreview(evaluation),
    };
  }

  const extraction = getNodeExtraction(node);
  if (extraction) {
    return {
      color,
      isTool: false,
      title:
        getStringAttr(node, SpanFields.GEN_AI_REQUEST_MODEL) ||
        getStringAttr(node, SpanFields.GEN_AI_RESPONSE_MODEL) ||
        op,
      secondary: getExtractionPreview(extraction),
    };
  }

  // Memory operations report their own `gen_ai.operation.type`, so they fall
  // through the op-type switch below; recognize them by operation name here.
  const memory = getNodeMemory(node);
  if (memory) {
    return {
      color,
      isTool: false,
      title: memory.operation ?? op,
      secondary: getMemoryPreview(memory),
    };
  }

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
      return {color, isTool: false, title: name || op, secondary: model};
    }
    case GenAiOperationType.AI_CLIENT: {
      const responseModel = getStringAttr(node, SpanFields.GEN_AI_RESPONSE_MODEL);
      const title = responseModel || description || op;
      return {color, isTool: false, title, secondary: title === op ? '' : op};
    }
    case GenAiOperationType.TOOL: {
      const toolName = getStringAttr(node, SpanFields.GEN_AI_TOOL_NAME);
      const inputPreview = getToolInputPreview(node);
      return {color, isTool: true, title: toolName || op, secondary: inputPreview || ''};
    }
    case GenAiOperationType.HANDOFF:
      return {color, isTool: false, title: op, secondary: description || ''};
    default:
      return {color, isTool: false, title: op, secondary: description || ''};
  }
}

// Tag's inner text already truncates, but text-overflow is ignored on its flex
// container, so flip it to block. Width is bounded by the Flex wrapper.
const EllipsisTag = styled(Tag)`
  min-width: 0;

  & > * {
    display: block;
  }
`;

const RowContainer = styled('div')<{depth: number}>`
  display: flex;
  align-items: center;
  width: 100%;
  padding-left: ${p => p.depth * INDENT_PX}px;

  /* Hover/active feedback only applies while the row is not selected, so the
   * selected background is never masked. */
  &:not([data-selected='true']):hover {
    border-radius: ${p => p.theme.radius.xs};
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &:not([data-selected='true']):active {
    border-radius: ${p => p.theme.radius.xs};
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.active};
  }

  &[data-selected='true'] {
    border-radius: ${p => p.theme.radius.xs};
    background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
  }
`;

const SelectButton = styled('button')`
  width: 100%;
  border: none;
  font: inherit;
  color: inherit;
  text-align: left;
  padding: ${p => p.theme.space.xs};
  border-radius: 0;
  cursor: pointer;
  background-color: transparent;
`;

const TimelineBar = styled('div')<{
  color: string;
  relativeTiming: {leftPercent: number; widthPercent: number};
}>`
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: ${p => p.theme.radius.full};
  background-color: ${p => p.theme.tokens.dataviz.semantic.other};

  &::before {
    content: '';
    position: absolute;
    left: ${p => p.relativeTiming.leftPercent}%;
    top: 0;
    height: 100%;
    width: ${p => p.relativeTiming.widthPercent}%;
    background-color: ${p => p.color};
    border-radius: ${p => p.theme.radius.full};
  }
`;
