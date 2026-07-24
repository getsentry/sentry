import {Fragment, memo, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Count} from 'sentry/components/count';
import {Placeholder} from 'sentry/components/placeholder';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {
  calculateRelativeTiming,
  getCompressedTimeBounds,
  getNodeTimeBounds,
  type TraceBounds,
} from 'sentry/views/insights/pages/agents/components/aiSpanList';
import {AiSpanStatusIcon} from 'sentry/views/insights/pages/agents/components/aiSpanStatusIcon';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {
  type ColorByOpType,
  getToolInputPreview,
  getGenAiOpType,
  getIsAiAgentNode,
  getNumberAttr,
  getSpanColor,
  getStringAttr,
  getTimelineColorByOpType,
  hasError,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {getToolOutputBytes} from 'sentry/views/insights/pages/agents/utils/getToolOutputBytes';
import {GenAiOperationType} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

interface SpanPresentation {
  color: string;
  isTool: boolean;
  secondary: string;
  title: string;
}

export function AiSpanTimeline({
  nodes,
  selectedNodeKey,
  onSelectNode,
  compressGaps = false,
  isLoading = false,
}: {
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeKey: string | null;
  compressGaps?: boolean;
  isLoading?: boolean;
}) {
  const compressedBounds = useMemo(
    () => (compressGaps ? getCompressedTimeBounds(nodes) : null),
    [compressGaps, nodes]
  );
  const timeBounds = useMemo(
    () => compressedBounds ?? getNodeTimeBounds(nodes),
    [compressedBounds, nodes]
  );

  const nodeAiRunParentsMap = useMemo<Record<string, AITraceSpanNode>>(() => {
    const parents: Record<string, AITraceSpanNode> = {};
    for (const node of nodes) {
      const parent =
        getGenAiOpType(node) === GenAiOperationType.AGENT
          ? node
          : node.findParent(p => getIsAiAgentNode(p));
      if (parent) {
        parents[node.id] = parent;
      }
    }
    return parents;
  }, [nodes]);

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  return (
    <Stack gap="xs">
      {nodes.map(node => {
        const aiRunNode = nodeAiRunParentsMap[node.id];
        const shouldIndent = aiRunNode && aiRunNode !== node;
        return (
          <TimelineRow
            key={node.id}
            node={node}
            indent={shouldIndent ? 1 : 0}
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

const TimelineRow = memo(function TimelineRow({
  node,
  onSelectNode,
  isSelected,
  indent,
  traceBounds,
  compressedStartByNodeId,
}: {
  indent: number;
  isSelected: boolean;
  node: AITraceSpanNode;
  onSelectNode: (node: AITraceSpanNode) => void;
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
    <Flex align="center">
      {({className}) => (
        <RowContainer
          type="button"
          className={className}
          data-selected={isSelected}
          indent={indent}
          onClick={() => onSelectNode(node)}
        >
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
                    variant={isSelected ? 'primary' : 'muted'}
                    monospace
                  >
                    {title}
                  </InfoText>
                </Container>
              )}
              <Flex flex="1" minWidth="0">
                {secondary && (
                  <InfoText
                    title={secondary}
                    mode="overflowOnly"
                    maxWidth={500}
                    size="sm"
                    variant="muted"
                  >
                    {secondary}
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
                  {getDuration(duration, 2, true, true)}
                </Text>
              </Flex>
            </Flex>
            <TimelineBar color={color} relativeTiming={relativeTiming} />
          </Stack>
        </RowContainer>
      )}
    </Flex>
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
        color,
        isTool: false,
        title: name || op,
        secondary: model ? `${op} (${model})` : op,
      };
    }
    case GenAiOperationType.AI_CLIENT: {
      const responseModel = getStringAttr(node, SpanFields.GEN_AI_RESPONSE_MODEL);
      const title = responseModel || description || op;
      return {
        color,
        isTool: false,
        title,
        secondary: title === op ? '' : op,
      };
    }
    case GenAiOperationType.TOOL: {
      const toolName = getStringAttr(node, SpanFields.GEN_AI_TOOL_NAME);
      const inputPreview = getToolInputPreview(node);
      return {
        color,
        isTool: true,
        title: toolName || op,
        secondary: inputPreview || '',
      };
    }
    case GenAiOperationType.HANDOFF:
      return {
        color,
        isTool: false,
        title: op,
        secondary: description || '',
      };
    default:
      return {
        color,
        isTool: false,
        title: op,
        secondary: description || '',
      };
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

const RowContainer = styled('button')<{
  indent: number;
}>`
  width: 100%;
  border: none;
  font: inherit;
  color: inherit;
  text-align: left;
  padding: ${p => p.theme.space.xs};
  padding-left: ${p => (p.indent ? p.indent * 16 : 4)}px;
  border-radius: 0;
  cursor: pointer;
  background-color: transparent;

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
