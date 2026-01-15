import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import {Tag} from 'sentry/components/core/badge/tag';
import {Container, Flex, Stack} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import EmptyMessage from 'sentry/components/emptyMessage';
import {IconUser} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {t} from 'sentry/locale';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {
  getIsAiGenerationSpan,
  getIsExecuteToolSpan,
} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';

interface ToolCall {
  name: string;
  nodeId: string;
}

interface ConversationMessage {
  content: string;
  id: string;
  nodeId: string;
  role: 'user' | 'assistant';
  timestamp: number;
  toolCalls?: ToolCall[];
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

function getNodeTimestamp(node: AITraceSpanNode): number {
  return 'start_timestamp' in node.value ? node.value.start_timestamp : 0;
}

function getGenAiOpType(node: AITraceSpanNode): string | undefined {
  return node.attributes?.[SpanFields.GEN_AI_OPERATION_TYPE] as string | undefined;
}

function partitionSpansByType(nodes: AITraceSpanNode[]): {
  generationSpans: AITraceSpanNode[];
  toolSpans: AITraceSpanNode[];
} {
  const generationSpans: AITraceSpanNode[] = [];
  const toolSpans: AITraceSpanNode[] = [];

  for (const node of nodes) {
    const opType = getGenAiOpType(node);
    if (getIsAiGenerationSpan(opType)) {
      generationSpans.push(node);
    } else if (getIsExecuteToolSpan(opType)) {
      toolSpans.push(node);
    }
  }

  generationSpans.sort((a, b) => getNodeTimestamp(a) - getNodeTimestamp(b));
  toolSpans.sort((a, b) => getNodeTimestamp(a) - getNodeTimestamp(b));

  return {generationSpans, toolSpans};
}

function findToolCallsBetween(
  toolSpans: AITraceSpanNode[],
  startTime: number,
  endTime: number
): ToolCall[] {
  return toolSpans
    .filter(span => {
      const ts = getNodeTimestamp(span);
      return ts > startTime && ts < endTime;
    })
    .map(span => {
      const name = span.attributes?.[SpanFields.GEN_AI_TOOL_NAME] as string | undefined;
      return name ? {name, nodeId: span.id} : null;
    })
    .filter((tc): tc is ToolCall => tc !== null);
}

function parseUserContent(node: AITraceSpanNode): string | null {
  const requestMessages = node.attributes?.[SpanFields.GEN_AI_REQUEST_MESSAGES] as
    | string
    | undefined;

  if (!requestMessages) {
    return null;
  }

  try {
    const messagesArray: RequestMessage[] = JSON.parse(requestMessages);
    const userMessage = messagesArray.findLast(msg => msg.role === 'user' && msg.content);
    if (!userMessage?.content) {
      return null;
    }
    return typeof userMessage.content === 'string'
      ? userMessage.content
      : (userMessage.content[0]?.text ?? null);
  } catch {
    return requestMessages;
  }
}

function parseAssistantContent(node: AITraceSpanNode): string | null {
  return (
    (node.attributes?.[SpanFields.GEN_AI_RESPONSE_TEXT] as string | undefined) ||
    (node.attributes?.[SpanFields.GEN_AI_RESPONSE_OBJECT] as string | undefined) ||
    null
  );
}

/**
 * Extracts messages from LLM generation spans.
 * User messages come from gen_ai.request.messages, assistant messages from gen_ai.response.text.
 * Tool calls are extracted from tool spans that occur just before each generation span.
 */
function extractMessagesFromNodes(nodes: AITraceSpanNode[]): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  const seenUserContent = new Set<string>();
  const seenAssistantContent = new Set<string>();

  const {generationSpans, toolSpans} = partitionSpansByType(nodes);

  for (let i = 0; i < generationSpans.length; i++) {
    const node = generationSpans[i];
    if (!node) {
      continue;
    }

    const timestamp = getNodeTimestamp(node);
    const prevTimestamp = i > 0 ? getNodeTimestamp(generationSpans[i - 1]!) : 0;
    const userEmail = node.attributes?.[SpanFields.USER_EMAIL] as string | undefined;
    const toolCalls = findToolCallsBetween(toolSpans, prevTimestamp, timestamp);

    const userContent = parseUserContent(node);
    if (userContent && !seenUserContent.has(userContent)) {
      seenUserContent.add(userContent);
      messages.push({
        id: `user-${node.id}`,
        role: 'user',
        content: userContent,
        timestamp,
        nodeId: node.id,
        userEmail,
      });
    }

    const assistantContent = parseAssistantContent(node);
    if (assistantContent && !seenAssistantContent.has(assistantContent)) {
      seenAssistantContent.add(assistantContent);
      messages.push({
        id: `assistant-${node.id}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: timestamp + 1,
        nodeId: node.id,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      });
    }
  }

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
              <MessageHeader
                align="center"
                gap="sm"
                padding="sm md"
                justify={message.role === 'assistant' ? 'end' : 'start'}
              >
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
                      text={escapeXmlTags(message.content)}
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
                      return (
                        <ClickableTag
                          key={tool.nodeId}
                          variant="info"
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

const MessageHeader = styled(Flex)`
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
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
  width: 90%;
  align-self: ${p => (p.role === 'user' ? 'flex-start' : 'flex-end')};
  background-color: ${p =>
    p.role === 'user'
      ? p.theme.tokens.background.secondary
      : p.theme.tokens.background.primary};
  ${p =>
    p.isClickable &&
    `
    cursor: pointer;
    &:hover {
      border-color: ${p.theme.tokens.border.accent.moderate};
      background-color: ${p.theme.tokens.interactive.transparent.neutral.background.hover};
    }
    &:active {
      background-color: ${p.theme.tokens.interactive.transparent.neutral.background.active};
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

const ToolCallsFooter = styled(Flex)`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
`;

const ClickableTag = styled(Tag)`
  cursor: pointer;
  &:hover {
    opacity: 0.8;
  }
`;
