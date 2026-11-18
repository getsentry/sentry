import type {ReactNode} from 'react';
import {IconChevron} from '@sentry/icons/chevron';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CollapsibleChatRow} from 'sentry/components/ai/chat/collapsibleContent';
import {TurnMeta} from 'sentry/components/ai/chat/turnMeta';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useOrganization} from 'sentry/utils/useOrganization';
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
 * A sub-agent as a collapsed row laid out like a tool call row: the agent's
 * icon, its name and its task. A pill after the name, like the trace view's
 * children button, shows how many LLM calls it made and whether it's open.
 * Expanding it shows its own transcript, with the same bubbles and tool calls
 * as the rest of the conversation.
 */
export function SubAgentRow({
  call,
  nodeMap,
  renderMessages,
  selectedNodeId,
}: SubAgentRowProps) {
  const organization = useOrganization();
  const node = nodeMap.get(call.nodeId);

  return (
    <CollapsibleChatRow
      // The pill after the name shows the open state instead.
      showCaret={false}
      // Open when the selection is the sub-agent or inside it, so a deep-linked
      // or timeline-selected span stays visible instead of hidden.
      openWhen={selectedNodeId !== null && callContainsNode(call, selectedNodeId)}
      title={isOpen => (
        <Flex align="center" gap="sm" minWidth={0}>
          {node && <AiSpanStatusIcon node={node} />}
          <ToolTag name={call.name} hasError={call.hasError} />
          <ExpandPill count={call.llmCallCount} isOpen={isOpen} />
          {!isOpen && call.preview && (
            <Text size="xs" monospace variant="muted" ellipsis>
              {call.preview}
            </Text>
          )}
        </Flex>
      )}
      meta={
        <TurnMeta
          metric={null}
          duration={
            call.duration === undefined || call.duration <= 0 ? null : (
              <Text size="xs" variant="muted" tabular align="right">
                {getDuration(call.duration, 2, true)}
              </Text>
            )
          }
        />
      }
      onToggle={open =>
        trackAnalytics('conversations.detail.expand-subagent', {
          organization,
          expanded: open,
        })
      }
    >
      <Container padding="xs 0 xs sm">
        <Container borderLeft="muted" paddingLeft="md">
          {renderMessages(call.messages, selectedNodeId)}
        </Container>
      </Container>
    </CollapsibleChatRow>
  );
}

/**
 * Mirrors the trace view's children button: a pill with the number of LLM
 * calls inside and a chevron for the open state.
 */
function ExpandPill({count, isOpen}: {count: number; isOpen: boolean}) {
  return (
    <Flex
      align="center"
      justify="center"
      gap="2xs"
      flexShrink={0}
      // Same height and text size as the tag before it, so the two line up.
      height="20px"
      minWidth="36px"
      padding="0 sm"
      radius="full"
      border="primary"
      background="primary"
    >
      {count > 0 && (
        <Text size="sm" variant="muted" tabular>
          {count}
        </Text>
      )}
      <IconChevron direction={isOpen ? 'down' : 'right'} size="sm" variant="muted" />
    </Flex>
  );
}
