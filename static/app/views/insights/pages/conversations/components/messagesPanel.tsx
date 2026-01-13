import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import {Container, Flex, Stack} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import EmptyMessage from 'sentry/components/emptyMessage';
import {IconUser} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {t} from 'sentry/locale';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {getIsAiGenerationSpan} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';

interface ConversationMessage {
  content: string;
  id: string;
  nodeId: string;
  role: 'user' | 'assistant';
  timestamp: number;
  userEmail?: string;
}

interface RequestMessage {
  content: string | Array<{text: string}>;
  role: string;
}

// often injected into AI prompts to indicate the role of the message
const AI_PROMPT_TAGS = new Set([
  'thinking',
  'reasoning',
  'instructions',
  'user_message',
  'maybe_relevant_context',
]);

/**
 * Escapes known AI prompt tags so they display as literal text rather than
 * being stripped by the HTML sanitizer.
 */
function escapeXmlTags(text: string): string {
  return text.replace(
    /<(\/?)([a-z_][a-z0-9_:-]*)([^>]*)>/gi,
    (match, slash, tagName, rest) => {
      if (AI_PROMPT_TAGS.has(tagName.toLowerCase())) {
        return `&lt;${slash}${tagName}${rest}&gt;`;
      }
      return match;
    }
  );
}

/**
 * Extracts messages from LLM generation spans.
 * User messages come from gen_ai.request.messages, assistant messages from gen_ai.response.text
 */
function extractMessagesFromNodes(nodes: AITraceSpanNode[]): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  const seenUserMessages = new Set<string>();
  const seenAssistantMessages = new Set<string>();

  for (const node of nodes) {
    const genAiOpType = node.attributes?.[SpanFields.GEN_AI_OPERATION_TYPE] as
      | string
      | undefined;
    if (!getIsAiGenerationSpan(genAiOpType)) {
      continue;
    }

    const timestamp = 'start_timestamp' in node.value ? node.value.start_timestamp : 0;
    const userEmail = node.attributes?.[SpanFields.USER_EMAIL] as string | undefined;

    // Extract user input from request messages
    const requestMessages = node.attributes?.[SpanFields.GEN_AI_REQUEST_MESSAGES] as
      | string
      | undefined;

    if (requestMessages) {
      try {
        const messagesArray: RequestMessage[] = JSON.parse(requestMessages);
        const userMessage = messagesArray.findLast(
          msg => msg.role === 'user' && msg.content
        );
        if (userMessage?.content) {
          const content =
            typeof userMessage.content === 'string'
              ? userMessage.content
              : (userMessage.content[0]?.text ?? '');
          // Deduplicate user messages by content
          if (content && !seenUserMessages.has(content)) {
            seenUserMessages.add(content);
            messages.push({
              id: `user-${node.id}`,
              role: 'user',
              content,
              timestamp,
              nodeId: node.id,
              userEmail,
            });
          }
        }
      } catch {
        // If JSON parsing fails, use the raw string
        if (!seenUserMessages.has(requestMessages)) {
          seenUserMessages.add(requestMessages);
          messages.push({
            id: `user-${node.id}`,
            role: 'user',
            content: requestMessages,
            timestamp,
            nodeId: node.id,
            userEmail,
          });
        }
      }
    }

    // Extract assistant output - link to the span node
    const responseText =
      (node.attributes?.[SpanFields.GEN_AI_RESPONSE_TEXT] as string | undefined) ||
      (node.attributes?.[SpanFields.GEN_AI_RESPONSE_OBJECT] as string | undefined);
    // Deduplicate assistant messages by content
    if (responseText && !seenAssistantMessages.has(responseText)) {
      seenAssistantMessages.add(responseText);
      messages.push({
        id: `assistant-${node.id}`,
        role: 'assistant',
        content: responseText,
        timestamp: timestamp + 1,
        nodeId: node.id,
      });
    }
  }

  // Sort by timestamp
  messages.sort((a, b) => a.timestamp - b.timestamp);

  return messages;
}

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
        <Container padding="md xl">
          <Heading as="h6">{t('Messages')}</Heading>
        </Container>
        <EmptyMessage>{t('No messages found')}</EmptyMessage>
      </PanelContainer>
    );
  }

  return (
    <PanelContainer direction="column">
      <Container padding="md xl">
        <Heading as="h6" size="xl">
          {t('Messages')}
        </Heading>
      </Container>
      <ScrollableContent direction="column" padding="md">
        <Stack gap="md">
          {messages.map((message, index) => {
            const isSelected = message.id === effectiveSelectedMessageId;
            return (
              <MessageBubble
                key={index}
                role={message.role}
                isClickable
                isSelected={isSelected}
                onClick={() => handleMessageClick(message)}
              >
                <MessageHeader
                  align="center"
                  gap="sm"
                  padding="sm md"
                  justify={message.role === 'assistant' ? 'end' : 'start'}
                >
                  {message.role === 'user' ? (
                    <IconUser size="sm" />
                  ) : (
                    <IconBot size="sm" />
                  )}
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
                        text={escapeXmlTags(message.content)}
                      />
                    </MessageText>
                  </Container>
                </StyledClippedBox>
              </MessageBubble>
            );
          })}
        </Stack>
      </ScrollableContent>
    </PanelContainer>
  );
}

const PanelContainer = styled(Flex)`
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  overflow: hidden;
`;

const ScrollableContent = styled(Flex)`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
`;

const MessageHeader = styled(Flex)`
  background-color: ${p => p.theme.backgroundSecondary};
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
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
  ${p =>
    p.isClickable &&
    `
    cursor: pointer;
    &:hover {
      border-color: ${p.theme.tokens.border.accent.moderate};
      background-color: ${p.theme.tokens.background.secondary};
    }
  `}
  ${p =>
    p.isSelected &&
    `
    outline: 2px solid ${p.theme.tokens.focus.default};
    outline-offset: -2px;
  `}
`;

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
`;
