import {Stack} from '@sentry/scraps/layout';

import {TurnMeta, TurnMetaValue} from 'sentry/components/ai/chat/turnMeta';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  isSubAgentCall,
  type ToolCall,
  type TurnCall,
} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {getToolInputPreview} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {getToolOutputBytes} from 'sentry/views/insights/pages/agents/utils/getToolOutputBytes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

import {SubAgentRow, type RenderTranscriptMessages} from './subAgentRow';
import {ToolTag} from './toolTag';
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
 * Tool-call list for the redesigned transcript. Each row is an accent wrench +
 * `ToolTag` capped at the message width, with the size and duration
 * right-aligned. Selection shows an outline.
 * Sub-agents the turn's tools started share the list as collapsed rows.
 */
export function MessageToolCalls({
  toolCalls,
  selectedToolCallId,
  nodeMap,
  onSelectNode,
  renderMessages,
}: MessageToolCallsProps) {
  return (
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
}

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
      tag={<ToolTag name={tool.name} hasError={tool.hasError} />}
      preview={node ? getToolInputPreview(node) : null}
      meta={
        <TurnMeta
          metric={node ? <ToolOutputSize node={node} /> : null}
          duration={tool.duration}
        />
      }
    />
  );
}

function ToolOutputSize({node}: {node: AITraceSpanNode}) {
  const bytes = getToolOutputBytes(node);
  return <TurnMetaValue>{formatBytesBase10(bytes)}</TurnMetaValue>;
}
