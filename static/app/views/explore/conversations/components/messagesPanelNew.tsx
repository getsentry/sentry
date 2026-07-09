import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CollapsibleContent} from 'sentry/components/ai/chat/collapsibleContent';
import {
  AssistantMessageBlock,
  MessageBlock,
  UserMessageBlock,
} from 'sentry/components/ai/chat/messageBlock';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MessageToolCallsNew} from 'sentry/views/explore/conversations/components/messageToolCallsNew';
import {
  TURN_META_WIDTH,
  TurnMeta,
} from 'sentry/views/explore/conversations/components/turnMeta';
import {
  type ConversationMessage,
  extractMessagesFromNodes,
} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {EMPTY_TEXT_CONTENT} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';
import {getNumberAttr} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {formatLLMCosts} from 'sentry/views/insights/pages/agents/utils/formatLLMCosts';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {detectAIContentType} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentDetection';
import {AIContentRenderer} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';

interface MessagesPanelNewProps {
  nodeTraceMap: Map<string, string>;
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeId: string | null;
  isLoading?: boolean;
}

/**
 * Seer Explorer-styled conversation transcript, gated behind
 * `gen-ai-conversations-redesign`. The legacy `MessagesPanel` is the flag-off
 * path.
 */
export function MessagesPanelNew({
  nodes,
  selectedNodeId,
  onSelectNode,
  nodeTraceMap,
  isLoading,
}: MessagesPanelNewProps) {
  const organization = useOrganization();
  const messages = useMemo(() => extractMessagesFromNodes(nodes), [nodes]);

  // Detect XML once per list so selection re-renders don't re-parse every message.
  const hasXmlByMessageId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const message of messages) {
      map.set(
        message.id,
        detectAIContentType(message.content).type === 'markdown-with-xml'
      );
    }
    return map;
  }, [messages]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, AITraceSpanNode>();
    for (const node of nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [nodes]);

  const handleMessageClick = (message: ConversationMessage) => {
    trackAnalytics('conversations.message.click', {organization});
    const node = nodeMap.get(message.nodeId);
    if (node) {
      onSelectNode(node);
    }
  };

  if (isLoading) {
    return <MessagesPanelSkeleton />;
  }

  if (messages.length === 0) {
    return (
      <PanelContainer>
        <EmptyMessage>{t('No messages found')}</EmptyMessage>
      </PanelContainer>
    );
  }

  return (
    <PanelContainer>
      <Stack gap="0" width="100%">
        {messages.map(message => {
          const hasXmlTags = hasXmlByMessageId.get(message.id) ?? false;
          const isSelected = message.nodeId === selectedNodeId;

          if (message.role === 'user') {
            return (
              <UserMessageBlock key={message.id} expand={hasXmlTags}>
                <MessageText align="left">
                  <AIContentRenderer
                    text={message.content}
                    inline
                    autoCollapseLimit={10}
                  />
                </MessageText>
              </UserMessageBlock>
            );
          }

          return (
            <AssistantTurn
              key={message.id}
              message={message}
              hasXmlTags={hasXmlTags}
              isSelected={message.role === 'assistant' && isSelected}
              selectedNodeId={selectedNodeId}
              nodeMap={nodeMap}
              nodeTraceMap={nodeTraceMap}
              onSelectNode={onSelectNode}
              onClick={() => handleMessageClick(message)}
            />
          );
        })}
      </Stack>
    </PanelContainer>
  );
}

interface AssistantTurnProps {
  hasXmlTags: boolean;
  isSelected: boolean;
  message: ConversationMessage;
  nodeMap: Map<string, AITraceSpanNode>;
  nodeTraceMap: Map<string, string>;
  onClick: () => void;
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeId: string | null;
}

function AssistantTurn({
  message,
  hasXmlTags,
  isSelected,
  selectedNodeId,
  nodeMap,
  nodeTraceMap,
  onSelectNode,
  onClick,
}: AssistantTurnProps) {
  const generationNode = nodeMap.get(message.nodeId);
  // Spans often report `gen_ai.cost.total_tokens` as 0 when the API omits cost;
  // treat that as absent so we don't show `<$0.01`, matching the timeline.
  const cost = generationNode
    ? getNumberAttr(generationNode, SpanFields.GEN_AI_COST_TOTAL_TOKENS) || undefined
    : undefined;
  const hasMeta =
    cost !== undefined || (message.duration !== undefined && message.duration > 0);
  const meta = <AssistantMeta cost={cost} duration={message.duration} />;

  return (
    <Fragment>
      {message.toolCalls && message.toolCalls.length > 0 && (
        <MessageBlock>
          <MessageToolCallsNew
            toolCalls={message.toolCalls}
            selectedNodeId={selectedNodeId}
            nodeMap={nodeMap}
            nodeTraceMap={nodeTraceMap}
            onSelectNode={onSelectNode}
          />
        </MessageBlock>
      )}
      {message.reasoning && (
        <MessageBlock>
          <ReasoningSection reasoning={message.reasoning} />
          <Container width={TURN_META_WIDTH} flexShrink={0} />
        </MessageBlock>
      )}
      {message.content === '' ? (
        // Tool/reasoning-only turn: still surface the turn's cost and duration.
        hasMeta && <MessageBlock justify="end">{meta}</MessageBlock>
      ) : message.content === EMPTY_TEXT_CONTENT ? (
        <AssistantMessageBlock meta={meta} isSelected={isSelected} onClick={onClick}>
          <MessageText align="left" variant="muted">
            {message.content}
          </MessageText>
        </AssistantMessageBlock>
      ) : (
        <AssistantMessageBlock
          expand={hasXmlTags}
          meta={meta}
          isSelected={isSelected}
          onClick={onClick}
        >
          <MessageText align="left">
            <AIContentRenderer text={message.content} inline autoCollapseLimit={10} />
          </MessageText>
        </AssistantMessageBlock>
      )}
    </Fragment>
  );
}

function AssistantMeta({cost, duration}: {cost?: number; duration?: number}) {
  return (
    <TurnMeta
      metric={
        cost === undefined || cost <= 0 ? null : (
          <Text size="xs" variant="muted" tabular align="right">
            {formatLLMCosts(cost)}
          </Text>
        )
      }
      duration={
        duration === undefined || duration <= 0 ? null : (
          <Text size="xs" variant="muted" tabular align="right">
            {getDuration(duration, 2, true)}
          </Text>
        )
      }
    />
  );
}

function ReasoningSection({reasoning}: {reasoning: string}) {
  const organization = useOrganization();

  return (
    <CollapsibleContent
      title={
        <Text size="sm" variant="muted" monospace>
          {t('Thinking...')}
        </Text>
      }
      preview={
        <Text size="sm" variant="muted" monospace>
          {reasoning}
        </Text>
      }
      onToggle={open =>
        trackAnalytics('conversations.detail.expand-thinking', {
          organization,
          expanded: open,
        })
      }
    >
      <Container padding="xs md">
        <MessageText size="sm" align="left" variant="muted" monospace>
          <AIContentRenderer text={reasoning} inline autoCollapseLimit={10} />
        </MessageText>
      </Container>
    </CollapsibleContent>
  );
}

/**
 * Loading state for the transcript. Mirrors the real layout — right-aligned
 * user bubbles and left-aligned assistant bubbles with a metadata column — so
 * the skeleton reads as a conversation rather than a generic list.
 */
export function MessagesPanelSkeleton() {
  const theme = useTheme();
  const invertedPlaceholderStyle = {
    backgroundColor: theme.tokens.background.primary,
  };

  return (
    <PanelContainer>
      <Stack gap="0" width="100%">
        <UserMessageBlock>
          <Placeholder height="14px" width="180px" />
        </UserMessageBlock>
        <AssistantMessageBlock meta={<Placeholder height="12px" width="48px" />}>
          <Flex direction="column" gap="md">
            <Placeholder style={invertedPlaceholderStyle} height="12px" width="320px" />
            <Placeholder style={invertedPlaceholderStyle} height="12px" width="260px" />
            <Placeholder style={invertedPlaceholderStyle} height="12px" width="180px" />
          </Flex>
        </AssistantMessageBlock>
        <UserMessageBlock>
          <Placeholder height="14px" width="120px" />
        </UserMessageBlock>
        <AssistantMessageBlock meta={<Placeholder height="12px" width="48px" />}>
          <Flex direction="column" gap="md">
            <Placeholder style={invertedPlaceholderStyle} height="12px" width="280px" />
            <Placeholder style={invertedPlaceholderStyle} height="12px" width="200px" />
          </Flex>
        </AssistantMessageBlock>
      </Stack>
    </PanelContainer>
  );
}

function PanelContainer({children}: {children: React.ReactNode}) {
  return (
    <Flex
      direction="column"
      padding="xl 0"
      background="primary"
      minHeight="100%"
      width="100%"
    >
      {children}
    </Flex>
  );
}

const MessageText = styled(Text)`
  word-break: break-word;

  /* Wide block content (tables, code) scrolls within the bubble instead of
   * overflowing it or forcing it wider. */
  table,
  pre {
    display: block;
    max-width: 100%;
    overflow-x: auto;
  }
`;
