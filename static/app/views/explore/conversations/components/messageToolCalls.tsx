import {Fragment} from 'react';
import styled from '@emotion/styled';
import {IconFix} from '@sentry/icons/fix';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  CARET_WIDTH,
  CollapsibleChatRow,
} from 'sentry/components/ai/chat/collapsibleContent';
import {TurnMeta} from 'sentry/components/ai/chat/turnMeta';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSelectionOpenState} from 'sentry/views/explore/conversations/hooks/useSelectionOpenState';
import {
  isSubAgentCall,
  type ToolCall,
  type TurnCall,
} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {AiSpanIssueLink} from 'sentry/views/insights/pages/agents/components/aiSpanRow';
import {getToolInputPreview} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {getToolOutputBytes} from 'sentry/views/insights/pages/agents/utils/getToolOutputBytes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

import {SubAgentRow, type RenderTranscriptMessages} from './subAgentRow';
import {TranscriptSpanRow} from './transcriptSpanRow';

interface MessageToolCallsProps {
  nodeMap: Map<string, AITraceSpanNode>;
  onSelectNode: (node: AITraceSpanNode) => void;
  /** Renders a sub-agent's transcript when its row is expanded. */
  renderMessages: RenderTranscriptMessages;
  /**
   * The selected node id when it is one of these calls or inside one of them,
   * otherwise null — scoped by the parent turn so the prop is stable when the
   * selection lands elsewhere.
   */
  selectedToolCallId: string | null;
  toolCalls: TurnCall[];
}

/**
 * A turn with fewer tool calls than this reads fine as a plain list, so it is
 * left expanded; longer runs are the ones that bury the surrounding reasoning.
 */
const COLLAPSE_THRESHOLD = 5;

/**
 * Tool-call list for the transcript. Runs of at least `COLLAPSE_THRESHOLD`
 * calls collapse behind a summary naming each tool with its call count (red when
 * one of its calls errored), plus the combined output size and time across the
 * run, collapsed by default to keep tool-heavy turns compact; shorter runs
 * render inline. Each row is laid out like an Agent Timeline row: icon, bold
 * name and arguments, with the size and duration right-aligned. Sub-agents the
 * turn's tools started share the list as collapsed rows.
 */
export function MessageToolCalls({
  toolCalls,
  selectedToolCallId,
  nodeMap,
  onSelectNode,
  renderMessages,
}: MessageToolCallsProps) {
  const organization = useOrganization();
  // Keeps the group open when one of its calls is (or holds) the selection, so
  // a deep-linked or timeline-selected row stays visible instead of hidden.
  const [isOpen, setIsOpen] = useSelectionOpenState(selectedToolCallId);

  const rows = (
    <Stack gap="xs" width="100%">
      {toolCalls.map(call => {
        if (isSubAgentCall(call)) {
          return (
            <SubAgentRow
              key={call.nodeId}
              call={call}
              nodeMap={nodeMap}
              selectedNodeId={selectedToolCallId}
              renderMessages={renderMessages}
            />
          );
        }
        return (
          <ToolCallRow
            key={call.nodeId}
            tool={call}
            node={nodeMap.get(call.nodeId)}
            isSelected={call.nodeId === selectedToolCallId}
            onSelectNode={onSelectNode}
          />
        );
      })}
    </Stack>
  );

  // Short runs read fine as a plain list — only collapse the long ones.
  if (toolCalls.length < COLLAPSE_THRESHOLD) {
    return rows;
  }

  // Aggregate the same per-row values into a run-level total so the summary
  // hints at how heavy the collapsed group is. Duration is the sum of each
  // call's own duration (parallel calls are counted separately), matching the
  // numbers on the rows rather than wall-clock elapsed time.
  const totalDuration = toolCalls.reduce(
    (sum, call) => sum + (call.duration && call.duration > 0 ? call.duration : 0),
    0
  );
  const totalBytes = toolCalls.reduce((sum, call) => {
    if (isSubAgentCall(call)) {
      return sum;
    }
    const node = nodeMap.get(call.nodeId);
    return sum + (node ? getToolOutputBytes(node) : 0);
  }, 0);
  const issueNode = toolCalls
    .map(call => nodeMap.get(call.nodeId))
    .find(node => node && node.uniqueIssues.length > 0);

  return (
    <CollapsibleChatRow
      open={isOpen}
      title={
        <Flex align="center" gap="sm" minWidth={0}>
          {/* Colored like a tool span's icon in the rows and the Agent Timeline. */}
          <IconFix size="md" variant="accent" />
          <ToolCallSummary toolCalls={toolCalls} />
        </Flex>
      }
      // The run-level totals line up over the per-row values in the same column.
      meta={
        <TurnMeta
          metric={totalBytes > 0 ? formatBytesBase10(totalBytes) : null}
          duration={totalDuration}
        />
      }
      aside={issueNode ? <AiSpanIssueLink node={issueNode} /> : null}
      onOpenChange={open => {
        setIsOpen(open);
        trackAnalytics('conversations.detail.expand-tool-calls', {
          organization,
          expanded: open,
        });
      }}
    >
      <ToolCallGroup>{rows}</ToolCallGroup>
    </CollapsibleChatRow>
  );
}

/**
 * Names the tools a collapsed run called, each with its call count, in the order
 * they were first called, e.g. `Read File 4  Bash 2`. A tool's name turns red
 * when any of its calls errored.
 */
function ToolCallSummary({toolCalls}: {toolCalls: TurnCall[]}) {
  const tools = new Map<string, {count: number; hasError: boolean}>();
  for (const call of toolCalls) {
    const tool = tools.get(call.name) ?? {count: 0, hasError: false};
    tool.count += 1;
    tool.hasError ||= call.hasError;
    tools.set(call.name, tool);
  }

  return (
    <Text size="sm" ellipsis>
      {Array.from(tools, ([name, {count, hasError}], index) => (
        <Fragment key={name}>
          {index > 0 ? '\u2003' : null}
          <Text size="sm" bold variant={hasError ? 'danger' : 'primary'}>
            {name} {count}
          </Text>
        </Fragment>
      ))}
    </Text>
  );
}

/**
 * The expanded run, on a background that sets it apart from the turn. It bleeds
 * into the gutter like the rows' hover, and indents the rows past the summary's
 * caret so their icons line up with the summary's.
 */
const ToolCallGroup = styled(Container)`
  margin: ${p => p.theme.space.xs} -${p => p.theme.space.sm} 0;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  padding-left: calc(
    ${p => p.theme.space.sm} + ${CARET_WIDTH} + ${p => p.theme.space.xs}
  );
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.secondary};
`;

interface ToolCallRowProps {
  isSelected: boolean;
  onSelectNode: (node: AITraceSpanNode) => void;
  tool: ToolCall;
  node?: AITraceSpanNode;
}

function ToolCallRow({tool, node, isSelected, onSelectNode}: ToolCallRowProps) {
  const organization = useOrganization();

  const selectTool = () => {
    trackAnalytics('conversations.message.click-tool-call', {organization});
    if (node) {
      onSelectNode(node);
    }
  };

  return (
    <TranscriptSpanRow
      node={node}
      isSelected={isSelected}
      ariaLabel={t('Select tool call %s', tool.name)}
      onSelect={selectTool}
      title={tool.name}
      hasError={tool.hasError}
      preview={node ? getToolInputPreview(node) : null}
      meta={
        <TurnMeta
          metric={node ? formatBytesBase10(getToolOutputBytes(node)) : null}
          duration={tool.duration}
          variant={tool.hasError ? 'danger' : 'muted'}
        />
      }
    />
  );
}
