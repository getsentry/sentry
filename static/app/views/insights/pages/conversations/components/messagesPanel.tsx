import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import ClippedBox from 'sentry/components/clippedBox';
import EmptyMessage from 'sentry/components/emptyMessage';
import {IconFire, IconUser} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {t} from 'sentry/locale';
import {MarkedText} from 'sentry/utils/marked/markedText';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
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
      <PanelContainer direction="column">
        <EmptyMessage>{t('No messages found')}</EmptyMessage>
      </PanelContainer>
    );
  }

  return (
    <PanelContainer direction="column">
      <Stack gap="md">
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
                {message.role === 'user' ? <IconUser size="sm" /> : <IconBot size="sm" />}
                <Text bold size="sm">
                  {message.role === 'user' ? t('User') : t('Assistant')}
                </Text>
                {message.role === 'user' && message.userEmail && (
                  <Text size="sm" style={{color: 'inherit', opacity: 0.7}}>
                    {message.userEmail}
                  </Text>
                )}
              </MessageHeader>
              <StyledClippedBox
                clipHeight={200}
                buttonProps={{priority: 'default', size: 'xs'}}
                collapsible
              >
                <Container padding="sm">
                  <MessageText size="sm">
                    <MarkedText
                      as={TraceDrawerComponents.MarkdownContainer}
                      text={message.content}
                    />
                  </MessageText>
                </Container>
              </StyledClippedBox>
              {message.role === 'assistant' &&
                message.toolCalls &&
                message.toolCalls.length > 0 && (
                  <ToolCallsFooter
                    direction="row"
                    align="center"
                    gap="xs"
                    wrap="wrap"
                    padding="xs sm"
                  >
                    <Text size="xs" style={{opacity: 0.7}}>
                      {t('Tools called:')}
                    </Text>
                    {message.toolCalls.map(tool => {
                      const toolNode = nodeMap.get(tool.nodeId);
                      const isToolSelected = tool.nodeId === selectedNodeId;
                      return (
                        <ClickableTag
                          key={tool.nodeId}
                          variant={tool.hasError ? 'danger' : 'info'}
                          icon={tool.hasError ? <IconFire /> : undefined}
                          hasError={tool.hasError}
                          isSelected={isToolSelected}
                          onClick={e => {
                            e.stopPropagation();
                            if (toolNode) {
                              onSelectNode(toolNode);
                            }
                          }}
                        >
                          {tool.name}
                        </ClickableTag>
                      );
                    })}
                  </ToolCallsFooter>
                )}
            </MessageBubble>
          );
        })}
      </Stack>
    </PanelContainer>
  );
}

const PanelContainer = styled(Flex)`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
`;

const MessageHeader = styled('div')<{justify?: 'start' | 'end'}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  justify-content: ${p => (p.justify === 'end' ? 'flex-end' : 'flex-start')};
  background-color: ${p => p.theme.tokens.background.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
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
    p.role === 'user'
      ? p.theme.tokens.background.secondary
      : p.theme.tokens.background.primary};
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
    }
    &:hover {
      background-color: ${p.theme.tokens.interactive.transparent.neutral.background.hover};
    }
    &:active {
      background-color: ${p.theme.tokens.interactive.transparent.neutral.background.active};
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

const ToolCallsFooter = styled(Flex)`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
`;

const ClickableTag = styled(Tag)<{hasError?: boolean; isSelected?: boolean}>`
  cursor: pointer;
  &:hover {
    opacity: 0.8;
  }
  ${p =>
    p.isSelected &&
    `
    outline: 2px solid ${p.hasError ? p.theme.tokens.content.danger : p.theme.tokens.focus.default};
    outline-offset: -2px;
  `}
`;
