import type {ReactNode} from 'react';
import {css, useTheme} from '@emotion/react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CollapsibleChatRow} from 'sentry/components/ai/chat/collapsibleContent';
import {TurnMeta} from 'sentry/components/ai/chat/turnMeta';
import {t, tn} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ToolTag} from 'sentry/views/explore/conversations/components/toolTag';
import type {ToolCall} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {AiSpanStatusIcon} from 'sentry/views/insights/pages/agents/components/aiSpanStatusIcon';
import {getToolInputPreview} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {getToolOutputBytes} from 'sentry/views/insights/pages/agents/utils/getToolOutputBytes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

interface MessageToolCallsProps {
  nodeMap: Map<string, AITraceSpanNode>;
  onSelectNode: (node: AITraceSpanNode) => void;
  /**
   * The selected node id when it matches one of these tool calls, otherwise
   * null — scoped by the parent turn so the prop is stable when the selection
   * lands elsewhere.
   */
  selectedToolCallId: string | null;
  toolCalls: ToolCall[];
}

/**
 * A turn with fewer tool calls than this reads fine as a plain list, so it is
 * left expanded; longer runs are the ones that bury the surrounding reasoning.
 */
const COLLAPSE_THRESHOLD = 5;

/**
 * Tool-call list for the redesigned transcript. Runs of at least
 * `COLLAPSE_THRESHOLD` calls collapse behind a `N tool calls` summary (with an
 * error count, plus the combined output size and time across the run) that is
 * collapsed by default, to keep tool-heavy turns compact; shorter runs render
 * inline. Each row is an accent wrench + `ToolTag` capped at the message width,
 * with the size and duration right-aligned. Selection shows an outline.
 */
export function MessageToolCalls({
  toolCalls,
  selectedToolCallId,
  nodeMap,
  onSelectNode,
}: MessageToolCallsProps) {
  const organization = useOrganization();

  const rows = (
    <Stack gap="xs" width="100%">
      {toolCalls.map(tool => (
        <ToolCallRow
          key={tool.nodeId}
          tool={tool}
          node={nodeMap.get(tool.nodeId)}
          isSelected={tool.nodeId === selectedToolCallId}
          onSelectNode={onSelectNode}
        />
      ))}
    </Stack>
  );

  // Short runs read fine as a plain list — only collapse the long ones.
  if (toolCalls.length < COLLAPSE_THRESHOLD) {
    return rows;
  }

  const errorCount = toolCalls.filter(tool => tool.hasError).length;

  // Aggregate the same per-row values into a run-level total so the summary
  // hints at how heavy the collapsed group is. Duration is the sum of each
  // call's own duration (parallel calls are counted separately), matching the
  // numbers on the rows rather than wall-clock elapsed time.
  const totalDuration = toolCalls.reduce(
    (sum, tool) => sum + (tool.duration && tool.duration > 0 ? tool.duration : 0),
    0
  );
  const totalBytes = toolCalls.reduce((sum, tool) => {
    const node = nodeMap.get(tool.nodeId);
    return sum + (node ? getToolOutputBytes(node) : 0);
  }, 0);

  return (
    <CollapsibleChatRow
      // Keep the group open when one of its calls is the current selection so a
      // deep-linked/timeline-selected row stays visible instead of hidden.
      defaultOpen={selectedToolCallId !== null}
      title={
        <Flex align="center" gap="sm" minWidth={0}>
          <Text size="sm" variant="muted">
            {tn('%s tool call', '%s tool calls', toolCalls.length)}
          </Text>
          {errorCount > 0 && (
            <Text size="sm" variant="danger">
              {tn('%s error', '%s errors', errorCount)}
            </Text>
          )}
        </Flex>
      }
      // The run-level totals line up over the per-row values in the same column.
      meta={
        <TurnMeta
          metric={
            totalBytes > 0 ? <MetaValue>{formatBytesBase10(totalBytes)}</MetaValue> : null
          }
          duration={
            totalDuration > 0 ? (
              <MetaValue>{getDuration(totalDuration, 2, true)}</MetaValue>
            ) : null
          }
        />
      }
      onToggle={open =>
        trackAnalytics('conversations.detail.expand-tool-calls', {
          organization,
          expanded: open,
        })
      }
    >
      <Container paddingTop="xs">{rows}</Container>
    </CollapsibleChatRow>
  );
}

interface ToolCallRowProps {
  isSelected: boolean;
  onSelectNode: (node: AITraceSpanNode) => void;
  tool: ToolCall;
  node?: AITraceSpanNode;
}

function ToolCallRow({tool, node, isSelected, onSelectNode}: ToolCallRowProps) {
  const organization = useOrganization();
  const theme = useTheme();

  // Widen past the content so the outline clears the icon/duration, then pull
  // back with a negative margin to keep them message-aligned (no scraps prop
  // for negative margins or hover).
  const rowCss = css`
    width: calc(100% + ${theme.space.sm} * 2);
    margin: 0 -${theme.space.sm};
    &:hover {
      background: ${theme.tokens.interactive.transparent.neutral.background.hover};
    }
  `;

  const selectTool = () => {
    trackAnalytics('conversations.message.click-tool-call', {
      organization,
    });
    if (node) {
      onSelectNode(node);
    }
  };

  return (
    <Container
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={t('Select tool call %s', tool.name)}
      radius="sm"
      padding="sm sm"
      cursor="pointer"
      css={rowCss}
      data-selected={isSelected}
      style={
        isSelected
          ? {
              outline: `2px solid ${theme.tokens.focus.default}`,
              outlineOffset: '-2px',
            }
          : undefined
      }
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        selectTool();
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          selectTool();
        }
      }}
    >
      <Flex align="center" justify="between" gap="md" width="100%">
        <Flex align="center" gap="sm" minWidth={0}>
          {node && <AiSpanStatusIcon node={node} />}
          <ToolTag name={tool.name} hasError={tool.hasError} />
          {node && <ToolInputPreview node={node} />}
        </Flex>
        <TurnMeta
          metric={node ? <ToolOutputSize node={node} /> : null}
          duration={
            tool.duration === undefined || tool.duration <= 0 ? null : (
              <MetaValue>{getDuration(tool.duration, 2, true)}</MetaValue>
            )
          }
        />
      </Flex>
    </Container>
  );
}

/** Shared right-aligned styling for the size/duration values in the meta column. */
function MetaValue({children}: {children: ReactNode}) {
  return (
    <Text size="xs" variant="muted" tabular align="right">
      {children}
    </Text>
  );
}

function ToolOutputSize({node}: {node: AITraceSpanNode}) {
  const bytes = getToolOutputBytes(node);
  return <MetaValue>{formatBytesBase10(bytes)}</MetaValue>;
}

function ToolInputPreview({node}: {node: AITraceSpanNode}) {
  const inputPreview = getToolInputPreview(node);
  if (!inputPreview) {
    return null;
  }
  return (
    <Text size="xs" monospace variant="muted" ellipsis>
      {inputPreview}
    </Text>
  );
}
