import type {ReactNode} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CollapsibleChatRow} from 'sentry/components/ai/chat/collapsibleContent';
import {TurnMeta} from 'sentry/components/ai/chat/turnMeta';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSelectionOpenState} from 'sentry/views/explore/conversations/hooks/useSelectionOpenState';
import {
  callContainsNode,
  type ConversationMessage,
  type SubAgentCall,
} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {AiSpanStatusIcon} from 'sentry/views/insights/pages/agents/components/aiSpanStatusIcon';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

import {ToolTag} from './toolTag';

/**
 * Renders a nested transcript. Passed in by the panel, which owns the message
 * rendering, so a sub-agent row can show its transcript recursively. The caller
 * passes the selection scoped to it, keeping the renderer itself stable.
 */
export type RenderTranscriptMessages = (
  messages: ConversationMessage[],
  selectedNodeId: string | null
) => ReactNode;

interface SubAgentRowProps {
  call: SubAgentCall;
  nodeMap: Map<string, AITraceSpanNode>;
  renderMessages: RenderTranscriptMessages;
  selectedNodeId: string | null;
}

/**
 * A sub-agent as a collapsed row laid out like a tool call row: the leading
 * caret shared with the transcript's other collapsible rows and the Agent
 * Timeline, then the agent's icon, its name and its task. Expanding it shows its
 * own transcript, with the same bubbles and tool calls as the rest of the
 * conversation.
 */
export function SubAgentRow({
  call,
  nodeMap,
  renderMessages,
  selectedNodeId,
}: SubAgentRowProps) {
  const organization = useOrganization();
  const node = nodeMap.get(call.nodeId);
  // Opens when the selection is the sub-agent or inside it, so a deep-linked or
  // timeline-selected span stays visible instead of hidden.
  const [isOpen, setIsOpen] = useSelectionOpenState(
    selectedNodeId !== null && callContainsNode(call, selectedNodeId)
      ? selectedNodeId
      : null
  );

  return (
    <CollapsibleChatRow
      open={isOpen}
      title={
        <Flex align="center" gap="sm" minWidth={0}>
          {node && <AiSpanStatusIcon node={node} />}
          <ToolTag name={call.name} hasError={call.hasError} />
          {!isOpen && call.preview && (
            <Text size="xs" monospace variant="muted" ellipsis>
              {call.preview}
            </Text>
          )}
        </Flex>
      }
      meta={<TurnMeta duration={call.duration} />}
      onOpenChange={open => {
        setIsOpen(open);
        trackAnalytics('conversations.detail.expand-subagent', {
          organization,
          expanded: open,
        });
      }}
    >
      <Container padding="xs 0 xs sm">
        <Container borderLeft="muted" paddingLeft="md">
          {renderMessages(call.messages, selectedNodeId)}
        </Container>
      </Container>
    </CollapsibleChatRow>
  );
}
