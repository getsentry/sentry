import {Fragment, memo, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {MessageRow} from '@sentry/scraps/chat';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {CollapsibleContent} from 'sentry/components/ai/chat/collapsibleContent';
import {
  AssistantMessageBlock,
  UserMessageBlock,
} from 'sentry/components/ai/chat/messageBlock';
import {Placeholder} from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {MessageToolCallsNew} from 'sentry/views/explore/conversations/components/messageToolCallsNew';
import {
  TURN_META_WIDTH,
  TurnMeta,
} from 'sentry/views/explore/conversations/components/turnMeta';
import {
  type ConversationMessage,
  extractMessagesFromNodes,
  partitionSpansByType,
} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {EMPTY_TEXT_CONTENT} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';
import {getNumberAttr} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {getAiInstrumentationDocsLink} from 'sentry/views/insights/pages/agents/utils/docsLinks';
import {formatLLMCosts} from 'sentry/views/insights/pages/agents/utils/formatLLMCosts';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {detectAIContentType} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentDetection';
import {AIContentRenderer} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';

interface MessagesPanelNewProps {
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeId: string | null;
  isLoading?: boolean;
  /**
   * Switches the conversation view to the Timeline tab. Surfaced from the
   * empty transcript state when a conversation has no inference spans.
   */
  onViewTimeline?: () => void;
}

/**
 * Seer Explorer-styled conversation transcript.
 */
export function MessagesPanelNew({
  nodes,
  selectedNodeId,
  onSelectNode,
  onViewTimeline,
  isLoading,
}: MessagesPanelNewProps) {
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

  if (isLoading) {
    return <MessagesPanelSkeleton />;
  }

  if (messages.length === 0) {
    // A conversation with no renderable transcript falls into two buckets we can
    // tell apart from the spans: inference (generation) spans that ran but never
    // captured their inputs/outputs, versus a conversation that has no inference
    // spans at all. Each gets its own explanation.
    const {generationSpans} = partitionSpansByType(nodes);
    return (
      <PanelContainer>
        {generationSpans.length > 0 ? (
          <MissingContentNotice nodes={nodes} />
        ) : (
          <NoInferenceSpansNotice onViewTimeline={onViewTimeline} />
        )}
      </PanelContainer>
    );
  }

  return (
    <PanelContainer>
      <Stack gap="0" width="100%">
        {messages.map(message => {
          const hasXmlTags = hasXmlByMessageId.get(message.id) ?? false;

          if (message.role === 'user') {
            return (
              <UserTurn
                key={message.id}
                content={message.content}
                hasXmlTags={hasXmlTags}
              />
            );
          }

          // Pass each turn only the selection state that concerns it, rather
          // than the shared `selectedNodeId`. A turn's props stay referentially
          // stable when the selection moves to an unrelated turn, so once these
          // rows are memoized only the turns that gain/lose selection re-render.
          const isSelected = message.nodeId === selectedNodeId;
          const selectedToolCallId = message.toolCalls?.some(
            tool => tool.nodeId === selectedNodeId
          )
            ? selectedNodeId
            : null;

          return (
            <AssistantTurn
              key={message.id}
              message={message}
              hasXmlTags={hasXmlTags}
              isSelected={isSelected}
              selectedToolCallId={selectedToolCallId}
              nodeMap={nodeMap}
              onSelectNode={onSelectNode}
            />
          );
        })}
      </Stack>
    </PanelContainer>
  );
}

// User turns carry no selection state, so their props never change on a
// selection change — memoized, they render once and always bail out after.
const UserTurn = memo(function UserTurn({
  content,
  hasXmlTags,
}: {
  content: string;
  hasXmlTags: boolean;
}) {
  return (
    <UserMessageBlock expand={hasXmlTags}>
      <MessageText align="left">
        <AIContentRenderer text={content} inline autoCollapseLimit={10} />
      </MessageText>
    </UserMessageBlock>
  );
});

interface AssistantTurnProps {
  hasXmlTags: boolean;
  isSelected: boolean;
  message: ConversationMessage;
  nodeMap: Map<string, AITraceSpanNode>;
  onSelectNode: (node: AITraceSpanNode) => void;
  /**
   * The selected node id when it belongs to one of this turn's tool calls,
   * otherwise null. Scoping it to the turn keeps the prop stable for turns
   * unaffected by a selection change.
   */
  selectedToolCallId: string | null;
}

// Memoized so a selection change only re-renders the turns that gain or lose
// selection. This relies on every prop being referentially stable per turn,
// which is why the click handler is built here rather than passed in.
const AssistantTurn = memo(function AssistantTurn({
  message,
  hasXmlTags,
  isSelected,
  selectedToolCallId,
  nodeMap,
  onSelectNode,
}: AssistantTurnProps) {
  const organization = useOrganization();
  const generationNode = nodeMap.get(message.nodeId);
  // Spans often report `gen_ai.cost.total_tokens` as 0 when the API omits cost;
  // treat that as absent so we don't show `<$0.01`, matching the timeline.
  const cost = generationNode
    ? getNumberAttr(generationNode, SpanFields.GEN_AI_COST_TOTAL_TOKENS) || undefined
    : undefined;
  const hasMeta =
    cost !== undefined || (message.duration !== undefined && message.duration > 0);
  const meta = <AssistantMeta cost={cost} duration={message.duration} />;

  const handleClick = () => {
    trackAnalytics('conversations.message.click', {organization});
    if (generationNode) {
      onSelectNode(generationNode);
    }
  };

  return (
    <Fragment>
      {message.toolCalls && message.toolCalls.length > 0 && (
        <MessageRow from="assistant" density="compact">
          <MessageToolCallsNew
            toolCalls={message.toolCalls}
            selectedToolCallId={selectedToolCallId}
            nodeMap={nodeMap}
            onSelectNode={onSelectNode}
          />
        </MessageRow>
      )}
      {message.reasoning && (
        <MessageRow from="assistant" density="compact">
          <ReasoningSection reasoning={message.reasoning} />
          <Container width={TURN_META_WIDTH} flexShrink={0} />
        </MessageRow>
      )}
      {message.content === '' ? (
        // Tool/reasoning-only turn: no bubble, but still surface the turn's cost
        // and duration, right-aligned to the meta column like other assistant turns.
        hasMeta && (
          <MessageRow from="assistant" density="compact">
            <Flex justify="end" width="100%">
              {meta}
            </Flex>
          </MessageRow>
        )
      ) : message.content === EMPTY_TEXT_CONTENT ? (
        <AssistantMessageBlock meta={meta} isSelected={isSelected} onClick={handleClick}>
          <MessageText align="left" variant="muted">
            {message.content}
          </MessageText>
        </AssistantMessageBlock>
      ) : (
        <AssistantMessageBlock
          expand={hasXmlTags}
          meta={meta}
          isSelected={isSelected}
          onClick={handleClick}
        >
          <MessageText align="left">
            <AIContentRenderer text={message.content} inline autoCollapseLimit={10} />
          </MessageText>
        </AssistantMessageBlock>
      )}
    </Fragment>
  );
});

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
 * Shown when inference spans ran but captured no input or output data, so
 * there is nothing to render as a transcript. Points to the docs for enabling
 * input/output capture, tailored to the project's platform.
 */
function MissingContentNotice({nodes}: {nodes: AITraceSpanNode[]}) {
  const projectSlug = useMemo(
    () => nodes.find(node => node.projectSlug)?.projectSlug,
    [nodes]
  );
  const {projects} = useProjects({slugs: projectSlug ? [projectSlug] : []});
  const platform = projectSlug
    ? projects.find(project => project.slug === projectSlug)?.platform
    : undefined;
  const docsLink = getAiInstrumentationDocsLink(platform);

  return (
    <EmptyNotice>
      <Text bold>{t("This conversation's messages weren't captured")}</Text>
      <Text variant="muted" align="center">
        {tct(
          "Its inference spans don't include any input or output data. [link:Enable capturing inputs and outputs] in your SDK to see the transcript here.",
          {link: <ExternalLink href={docsLink} />}
        )}
      </Text>
    </EmptyNotice>
  );
}

/**
 * Shown when a conversation has spans but none of them are inference spans, so
 * there is no transcript to build. Directs the user to the Timeline, where the
 * conversation's other spans are shown.
 */
function NoInferenceSpansNotice({onViewTimeline}: {onViewTimeline?: () => void}) {
  return (
    <EmptyNotice>
      <Text bold>{t("This conversation doesn't include any inference spans")}</Text>
      <Text variant="muted" align="center">
        {t('The other spans in this conversation are shown in the Timeline.')}
      </Text>
      {onViewTimeline && (
        <Button size="sm" onClick={onViewTimeline}>
          {t('View Timeline')}
        </Button>
      )}
    </EmptyNotice>
  );
}

function EmptyNotice({children}: {children: React.ReactNode}) {
  return (
    <Stack flex={1} align="center" justify="center" padding="xl" width="100%">
      <Stack align="center" gap="md" maxWidth="32rem">
        {children}
      </Stack>
    </Stack>
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
          <Stack gap="md">
            <Placeholder style={invertedPlaceholderStyle} height="12px" width="320px" />
            <Placeholder style={invertedPlaceholderStyle} height="12px" width="260px" />
            <Placeholder style={invertedPlaceholderStyle} height="12px" width="180px" />
          </Stack>
        </AssistantMessageBlock>
        <UserMessageBlock>
          <Placeholder height="14px" width="120px" />
        </UserMessageBlock>
        <AssistantMessageBlock meta={<Placeholder height="12px" width="48px" />}>
          <Stack gap="md">
            <Placeholder style={invertedPlaceholderStyle} height="12px" width="280px" />
            <Placeholder style={invertedPlaceholderStyle} height="12px" width="200px" />
          </Stack>
        </AssistantMessageBlock>
      </Stack>
    </PanelContainer>
  );
}

function PanelContainer({children}: {children: React.ReactNode}) {
  return (
    <Stack padding="xl 0" background="primary" minHeight="100%" width="100%">
      {children}
    </Stack>
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
