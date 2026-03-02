import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import ClippedBox from 'sentry/components/clippedBox';
import EmptyMessage from 'sentry/components/emptyMessage';
import {t} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {MarkedText} from 'sentry/utils/marked/markedText';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {MessageToolCalls} from 'sentry/views/insights/pages/conversations/components/messageToolCalls';
import type {ConversationMessage} from 'sentry/views/insights/pages/conversations/utils/conversationMessages';
import {extractMessagesFromNodes} from 'sentry/views/insights/pages/conversations/utils/conversationMessages';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';

interface MessagesPanelProps {
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeId: string | null;
}

export function MessagesPanel({nodes, selectedNodeId, onSelectNode}: MessagesPanelProps) {
  const messages = useMemo(() => extractMessagesFromNodes(nodes), [nodes]);
  const [clickedMessageId, setClickedMessageId] = useState<string | null>(null);

  // Compute effective selected message: use clicked message if it matches current node,
  // otherwise fall back to assistant message for the selected node
  const effectiveSelectedMessageId = useMemo(() => {
    if (clickedMessageId) {
      const clickedMessage = messages.find(m => m.id === clickedMessageId);
      if (clickedMessage?.nodeId === selectedNodeId) {
        return clickedMessageId;
      }
    }
    // Fall back to assistant message for the selected node
    const assistantMessage = messages.find(
      m => m.nodeId === selectedNodeId && m.role === 'assistant'
    );
    return assistantMessage?.id ?? null;
  }, [clickedMessageId, messages, selectedNodeId]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, AITraceSpanNode>();
    for (const node of nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [nodes]);

  const handleMessageClick = useCallback(
    (message: ConversationMessage) => {
      setClickedMessageId(message.id);
      const node = nodeMap.get(message.nodeId);
      if (node) {
        onSelectNode(node);
      }
    },
    [nodeMap, onSelectNode]
  );

  if (messages.length === 0) {
    return (
      <Flex
        direction="column"
        padding="lg lg md lg"
        background="secondary"
        minHeight="100%"
      >
        <EmptyMessage>{t('No messages found')}</EmptyMessage>
      </Flex>
    );
  }

  return (
    <Flex
      direction="column"
      padding="lg lg md lg"
      background="secondary"
      minHeight="100%"
    >
      <Stack gap="md" width="100%">
        {messages.map((message, index) => {
          const isSelected = message.id === effectiveSelectedMessageId;
          const isAssistant = message.role === 'assistant';
          return (
            <MessageBubble
              key={index}
              role={message.role}
              isClickable={isAssistant}
              isSelected={isAssistant && isSelected}
              onClick={isAssistant ? () => handleMessageClick(message) : undefined}
            >
              <MessageHeader justify={message.role === 'user' ? 'end' : 'start'}>
                {message.role === 'user' ? (
                  <Text bold size="sm">
                    {message.userEmail || t('User')}
                  </Text>
                ) : (
                  <Flex align="baseline" gap="sm" flex={1}>
                    <Text bold size="sm">
                      {t('Assistant')}
                    </Text>
                    {message.duration !== undefined && message.duration > 0 && (
                      <Text size="xs" variant="muted">
                        {getDuration(message.duration, 1, true)}
                      </Text>
                    )}
                  </Flex>
                )}
              </MessageHeader>
              <StyledClippedBox
                clipHeight={200}
                buttonProps={{priority: 'default', size: 'xs'}}
                collapsible
              >
                <Container padding="md">
                  <MessageText
                    size="sm"
                    align={message.role === 'user' ? 'right' : 'left'}
                  >
                    <MarkedText
                      as={TraceDrawerComponents.MarkdownContainer}
                      text={message.content}
                    />
                  </MessageText>
                </Container>
              </StyledClippedBox>
              {isAssistant && message.toolCalls && message.toolCalls.length > 0 && (
                <MessageToolCalls
                  toolCalls={message.toolCalls}
                  selectedNodeId={selectedNodeId}
                  nodeMap={nodeMap}
                  onSelectNode={onSelectNode}
                />
              )}
            </MessageBubble>
          );
        })}
      </Stack>
    </Flex>
  );
}

const MessageHeader = styled('div')<{justify?: 'start' | 'end'}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  justify-content: ${p => (p.justify === 'end' ? 'flex-end' : 'flex-start')};

  &::after {
    content: '';
    position: absolute;
    left: ${p => p.theme.space.md};
    right: ${p => p.theme.space.md};
    bottom: 0;
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
  position: relative;
`;

const MessageText = styled(Text)`
  word-break: break-word;
`;

const MessageBubble = styled('div')<{
  role: 'user' | 'assistant';
  isClickable?: boolean;
  isSelected?: boolean;
}>`
  position: relative;
  z-index: 0;
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
  width: 90%;
  align-self: ${p => (p.role === 'user' ? 'flex-end' : 'flex-start')};
  background-color: ${p =>
    p.role === 'assistant'
      ? p.theme.tokens.background.primary
      : p.theme.tokens.background.secondary};
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 1px solid ${p => p.theme.tokens.border.primary};
    border-radius: inherit;
    box-sizing: border-box;
    z-index: 1;
    pointer-events: none;
  }
  ${p =>
    p.isClickable &&
    `
    cursor: pointer;
    &:hover::after {
      border-color: ${p.theme.tokens.border.accent.moderate};
      border-width: 2px;
    }
  `}
  ${p =>
    p.isSelected &&
    `
    &::after {
      border-color: ${p.theme.tokens.focus.default};
      border-width: 2px;
    }
    &:hover::after {
      border-color: ${p.theme.tokens.focus.default};
    }
  `}
`;

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
`;
