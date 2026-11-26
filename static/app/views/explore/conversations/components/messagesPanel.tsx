import {memo, useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {MessageRow} from '@sentry/scraps/chat';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CollapsibleChatRow} from 'sentry/components/ai/chat/collapsibleContent';
import {
  AssistantMessageBlock,
  UserMessageBlock,
} from 'sentry/components/ai/chat/messageBlock';
import {
  TURN_META_WIDTH,
  TurnMeta,
  TurnMetaValue,
} from 'sentry/components/ai/chat/turnMeta';
import {Count} from 'sentry/components/count';
import {Placeholder} from 'sentry/components/placeholder';
import {t, tn} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useSelectionOpenState} from 'sentry/views/explore/conversations/hooks/useSelectionOpenState';
import {
  callContainsNode,
  type ConversationMessage,
  extractMessagesFromNodes,
  getConversationSystemPrompt,
  isSubAgentCall,
  messageContainsNode,
  NOT_REPORTED,
  someMessageDeep,
} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {ScrubbedText} from 'sentry/views/insights/pages/agents/components/scrubbedText';
import {EMPTY_TEXT_CONTENT} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';
import {
  getNumberAttr,
  getStringAttr,
  hasError,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {getAiInstrumentationDocsLink} from 'sentry/views/insights/pages/agents/utils/docsLinks';
import {getEvaluationPreview} from 'sentry/views/insights/pages/agents/utils/evaluation';
import {getExtractionPreview} from 'sentry/views/insights/pages/agents/utils/extraction';
import {getToolOutputBytes} from 'sentry/views/insights/pages/agents/utils/getToolOutputBytes';
import {getMemoryPreview} from 'sentry/views/insights/pages/agents/utils/memory';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {detectAIContentType} from 'sentry/views/performance/traceDetails/traceDrawer/details/span/eapSections/aiContentDetection';
import {AIContentRenderer} from 'sentry/views/performance/traceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';

import {ConversationMissingMessagesAlert} from './conversationMissingMessagesAlert';
import {MessageToolCalls} from './messageToolCalls';
import {SubAgentRow, type RenderTranscriptMessages} from './subAgentRow';
import {ToolTag} from './toolTag';
import {TranscriptSpanRow} from './transcriptSpanRow';

interface MessagesPanelProps {
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeId: string | null;
  isLoading?: boolean;
  /**
   * The transcript of `nodes`, for a caller that already built it. Built here
   * when omitted.
   */
  messages?: ConversationMessage[];
  /**
   * Switches the conversation view to the Timeline tab. Surfaced from the
   * empty transcript state when a conversation has no inference spans.
   */
  onViewTimeline?: () => void;
}

/**
 * Seer Explorer-styled conversation transcript.
 */
export function MessagesPanel({
  nodes,
  selectedNodeId,
  onSelectNode,
  onViewTimeline,
  isLoading,
  messages: messagesProp,
}: MessagesPanelProps) {
  const messages = useMemo(
    () => messagesProp ?? extractMessagesFromNodes(nodes),
    [messagesProp, nodes]
  );
  const systemPrompt = useMemo(() => getConversationSystemPrompt(nodes), [nodes]);

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

  // Inference spans always produce a transcript, with placeholders when their
  // content wasn't captured, so an empty one means there are none.
  if (messages.length === 0) {
    return (
      <PanelContainer>
        <NoInferenceSpansNotice onViewTimeline={onViewTimeline} />
      </PanelContainer>
    );
  }

  const hasNotReportedContent = someMessageDeep(
    messages,
    message => message.content === NOT_REPORTED
  );

  return (
    <PanelContainer>
      {hasNotReportedContent && <NotReportedAlert nodes={nodes} />}
      {systemPrompt && (
        <MessageRow from="assistant" density="line" data-node-id={systemPrompt.node.id}>
          <SystemPromptSection systemPrompt={systemPrompt.prompt} />
        </MessageRow>
      )}
      <TranscriptMessages
        messages={messages}
        nodeMap={nodeMap}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
      />
    </PanelContainer>
  );
}

interface TranscriptMessagesProps {
  messages: ConversationMessage[];
  nodeMap: Map<string, AITraceSpanNode>;
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeId: string | null;
  /** Rendered inside a sub-agent row, which already provides the row gutter. */
  nested?: boolean;
}

/**
 * The transcript's message list. Also renders a sub-agent's own transcript
 * inside its expanded row.
 */
function TranscriptMessages({
  messages,
  nodeMap,
  selectedNodeId,
  onSelectNode,
  nested = false,
}: TranscriptMessagesProps) {
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

  const blocks = useMemo(() => groupEventRuns(messages), [messages]);

  // Depends only on stable props: callers pass the selection scoped to them, so
  // memoized turns keep bailing out when the selection moves elsewhere.
  const renderNestedMessages = useCallback<RenderTranscriptMessages>(
    (nestedMessages, nestedSelectedNodeId) => (
      <TranscriptMessages
        nested
        messages={nestedMessages}
        nodeMap={nodeMap}
        selectedNodeId={nestedSelectedNodeId}
        onSelectNode={onSelectNode}
      />
    ),
    [nodeMap, onSelectNode]
  );

  const List = nested ? NestedMessageList : Stack;

  return (
    <List gap="0" width="100%">
      {blocks.map(block => {
        const rows = block.items.map(({message, part}) => {
          const key = part ? `${message.id}-${part}` : message.id;
          const hasXmlTags = hasXmlByMessageId.get(message.id) ?? false;

          if (message.role === 'user') {
            return (
              <UserTurn
                key={key}
                nodeId={message.nodeId}
                content={message.content}
                hasXmlTags={hasXmlTags}
              />
            );
          }

          if (message.role === 'embedding') {
            return (
              <EmbeddingTurn
                key={key}
                message={message}
                isSelected={message.nodeId === selectedNodeId}
              />
            );
          }

          if (message.role === 'evaluation') {
            return (
              <EvaluationTurn
                key={key}
                message={message}
                node={nodeMap.get(message.nodeId)}
                isSelected={message.nodeId === selectedNodeId}
                onSelectNode={onSelectNode}
              />
            );
          }

          if (message.role === 'extraction') {
            return (
              <ExtractionTurn
                key={key}
                message={message}
                node={nodeMap.get(message.nodeId)}
                isSelected={message.nodeId === selectedNodeId}
                onSelectNode={onSelectNode}
              />
            );
          }

          if (message.role === 'memory') {
            return (
              <MemoryTurn
                key={key}
                message={message}
                node={nodeMap.get(message.nodeId)}
                isSelected={message.nodeId === selectedNodeId}
                onSelectNode={onSelectNode}
              />
            );
          }

          if (message.subAgent) {
            return (
              <MessageRow
                key={key}
                from="assistant"
                density="line"
                data-node-id={message.nodeId}
              >
                <SubAgentRow
                  call={message.subAgent}
                  nodeMap={nodeMap}
                  selectedNodeId={selectedNodeId}
                  renderMessages={renderNestedMessages}
                />
              </MessageRow>
            );
          }

          // Pass each turn only the selection state that concerns it, rather
          // than the shared `selectedNodeId`. A turn's props stay referentially
          // stable when the selection moves to an unrelated turn, so once these
          // rows are memoized only the turns that gain/lose selection re-render.
          const isSelected = message.nodeId === selectedNodeId;
          const selectedToolCallId =
            selectedNodeId !== null &&
            message.toolCalls?.some(call => callContainsNode(call, selectedNodeId))
              ? selectedNodeId
              : null;

          return (
            <AssistantTurn
              key={key}
              message={message}
              hasXmlTags={hasXmlTags}
              isSelected={isSelected}
              selectedToolCallId={selectedToolCallId}
              nodeMap={nodeMap}
              onSelectNode={onSelectNode}
              renderMessages={renderNestedMessages}
              part={part}
            />
          );
        });
        return block.collapse ? (
          <EventRunGroup
            key={block.key}
            items={block.items}
            nodeMap={nodeMap}
            selectedNodeId={selectedNodeId}
          >
            {rows}
          </EventRunGroup>
        ) : (
          rows
        );
      })}
    </List>
  );
}

type TurnPart = 'events' | 'bubble';

interface TranscriptItem {
  message: ConversationMessage;
  /** Set when a turn with text is split around the end of an event run. */
  part?: TurnPart;
}

interface TranscriptBlock {
  /** Set for an event run long enough to collapse. */
  collapse: boolean;
  items: TranscriptItem[];
  key: string;
}

/**
 * Runs with fewer events than this read fine as a plain list; longer runs
 * bury the surrounding messages, so they collapse.
 */
const EVENT_RUN_COLLAPSE_THRESHOLD = 5;

function countEvents({message}: TranscriptItem): number {
  return message.role === 'assistant'
    ? (message.toolCalls?.length ?? 0) + (message.reasoning ? 1 : 0)
    : 1;
}

/**
 * Groups everything between bubbles (tool calls, sub-agents, thinking and
 * standalone spans) into runs. A turn with text is split: its tool calls and
 * thinking end the run, and its bubble follows it.
 */
function groupEventRuns(messages: ConversationMessage[]): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];
  let run: TranscriptItem[] = [];
  const pushBlock = (items: TranscriptItem[], collapse: boolean) => {
    if (items.length > 0) {
      const first = items[0]!;
      blocks.push({key: `${first.message.id}-${first.part}`, items, collapse});
    }
  };
  const endRun = () => {
    const eventCount = run.reduce((count, item) => count + countEvents(item), 0);
    pushBlock(run, eventCount >= EVENT_RUN_COLLAPSE_THRESHOLD);
    run = [];
  };

  for (const message of messages) {
    if (message.role === 'user') {
      endRun();
      pushBlock([{message}], false);
    } else if (message.role !== 'assistant' || message.content === '') {
      run.push({message});
    } else {
      if (message.reasoning || message.toolCalls?.length) {
        run.push({message, part: 'events'});
      }
      endRun();
      pushBlock([{message, part: 'bubble'}], false);
    }
  }
  endRun();
  return blocks;
}

function itemContainsNode({message, part}: TranscriptItem, nodeId: string): boolean {
  return part === 'events'
    ? (message.toolCalls?.some(call => callContainsNode(call, nodeId)) ?? false)
    : messageContainsNode(message, nodeId);
}

/**
 * A long event run collapsed behind a summary that counts each kind of event
 * and the errors, with the combined tool output size and time on the right.
 * Opens when the selected span is inside it.
 */
function EventRunGroup({
  children,
  items,
  nodeMap,
  selectedNodeId,
}: {
  children: React.ReactNode;
  items: TranscriptItem[];
  nodeMap: Map<string, AITraceSpanNode>;
  selectedNodeId: string | null;
}) {
  const organization = useOrganization();
  const [isOpen, setIsOpen] = useSelectionOpenState(
    selectedNodeId !== null && items.some(item => itemContainsNode(item, selectedNodeId))
      ? selectedNodeId
      : null
  );

  let tools = 0;
  let subAgents = 0;
  let thinking = 0;
  let spans = 0;
  let errors = 0;
  let duration = 0;
  let bytes = 0;
  for (const {message} of items) {
    if (message.role !== 'assistant') {
      const node = nodeMap.get(message.nodeId);
      errors += node && hasError(node) ? 1 : 0;
      duration += message.duration ?? 0;
      if (message.subAgent) {
        subAgents++;
      } else {
        spans++;
      }
      continue;
    }
    thinking += message.reasoning ? 1 : 0;
    for (const call of message.toolCalls ?? []) {
      errors += call.hasError ? 1 : 0;
      duration += call.duration ?? 0;
      if (isSubAgentCall(call)) {
        subAgents++;
      } else {
        tools++;
        const node = nodeMap.get(call.nodeId);
        bytes += node ? getToolOutputBytes(node) : 0;
      }
    }
  }

  const label = [
    tools && tn('%s tool call', '%s tool calls', tools),
    subAgents && tn('%s sub-agent', '%s sub-agents', subAgents),
    thinking && tn('%s thinking step', '%s thinking steps', thinking),
    spans && tn('%s other span', '%s other spans', spans),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <MessageRow from="assistant" density="line">
      <CollapsibleChatRow
        open={isOpen}
        title={
          <Flex align="center" gap="sm" minWidth={0}>
            <Text size="sm" variant="muted">
              {label}
            </Text>
            {errors > 0 && (
              <Text size="sm" variant="danger">
                {tn('%s error', '%s errors', errors)}
              </Text>
            )}
          </Flex>
        }
        meta={
          <TurnMeta
            metric={
              bytes > 0 ? <TurnMetaValue>{formatBytesBase10(bytes)}</TurnMetaValue> : null
            }
            duration={duration}
          />
        }
        onOpenChange={open => {
          setIsOpen(open);
          trackAnalytics('conversations.detail.expand-tool-calls', {
            organization,
            expanded: open,
          });
        }}
      >
        {/* No fixed width, so the negative margins widen the list on both sides
         * and the rows' meta column lines up with the summary's. */}
        <NestedMessageList gap="0">{children}</NestedMessageList>
      </CollapsibleChatRow>
    </MessageRow>
  );
}

// Rows inside a sub-agent row cancel their own horizontal gutter (`MessageRow`'s
// `xl` padding): the sub-agent row's indent already provides it, and doubling it
// pushes nested bubbles inward and the meta column out of line with the rows
// around it. Layout props can't express a negative margin, hence the styled
// wrapper.
const NestedMessageList = styled(Stack)`
  margin: 0 -${p => p.theme.space.xl};
`;

// User turns carry no selection state, so their props never change on a
// selection change — memoized, they render once and always bail out after.
const UserTurn = memo(function UserTurnImpl({
  content,
  hasXmlTags,
  nodeId,
}: {
  content: string;
  hasXmlTags: boolean;
  nodeId: string;
}) {
  return (
    // Search finds the span a transcript block renders by its data-node-id.
    <Container display="contents" data-node-id={nodeId}>
      {content === NOT_REPORTED ? (
        <UserMessageBlock>
          <MessageText align="left" variant="muted">
            {content}
          </MessageText>
        </UserMessageBlock>
      ) : (
        <UserMessageBlock expand={hasXmlTags}>
          <MessageText align="left">
            <AIContentRenderer text={content} inline autoCollapseLimit={10} />
          </MessageText>
        </UserMessageBlock>
      )}
    </Container>
  );
});

interface AssistantTurnProps {
  hasXmlTags: boolean;
  isSelected: boolean;
  message: ConversationMessage;
  nodeMap: Map<string, AITraceSpanNode>;
  onSelectNode: (node: AITraceSpanNode) => void;
  renderMessages: RenderTranscriptMessages;
  /**
   * The selected node id when it belongs to one of this turn's calls (or a
   * span inside a sub-agent call), otherwise null. Scoping it to the turn keeps
   * the prop stable for turns unaffected by a selection change.
   */
  selectedToolCallId: string | null;
  /** Renders only the turn's tool calls and thinking, or only its bubble. */
  part?: TurnPart;
}

// Memoized so a selection change only re-renders the turns that gain or lose
// selection. This relies on every prop being referentially stable per turn,
// which is why the click handler is built here rather than passed in.
const AssistantTurn = memo(function AssistantTurnImpl({
  message,
  hasXmlTags,
  isSelected,
  selectedToolCallId,
  nodeMap,
  onSelectNode,
  renderMessages,
  part,
}: AssistantTurnProps) {
  const organization = useOrganization();
  const theme = useTheme();
  const generationNode = nodeMap.get(message.nodeId);
  // Without a bubble, the turn's first row shows the selection instead.
  const isRowSelected = isSelected && message.content === '';
  const selectedRowStyle = isRowSelected
    ? {outline: `2px solid ${theme.tokens.focus.default}`, outlineOffset: '-2px'}
    : undefined;
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
    <Container display="contents" data-node-id={message.nodeId}>
      {part !== 'bubble' && message.toolCalls && message.toolCalls.length > 0 && (
        <MessageRow from="assistant" density="line">
          <MessageToolCalls
            toolCalls={message.toolCalls}
            selectedToolCallId={selectedToolCallId}
            nodeMap={nodeMap}
            onSelectNode={onSelectNode}
            renderMessages={renderMessages}
          />
        </MessageRow>
      )}
      {part !== 'bubble' && message.reasoning && (
        <MessageRow from="assistant" density="line">
          <Container
            width="100%"
            radius="xs"
            data-selected={isRowSelected}
            style={selectedRowStyle}
          >
            {/* A reasoning-only turn (no assistant bubble to hang meta on) surfaces
             * the turn's cost/duration in the thinking row's own meta column. */}
            <ReasoningSection
              reasoning={message.reasoning}
              meta={message.content === '' && hasMeta ? meta : undefined}
            />
          </Container>
        </MessageRow>
      )}
      {part === 'events' ? null : message.content === '' ? (
        // Tool-only turn (no reasoning row to carry it): no bubble, but still
        // surface the turn's cost and duration, right-aligned to the meta column
        // like other assistant turns. A reasoning row, when present, shows the
        // meta itself, so skip this fallback then.
        hasMeta &&
        !message.reasoning && (
          <MessageRow from="assistant" density="line">
            <Flex
              justify="end"
              width="100%"
              radius="xs"
              data-selected={isRowSelected}
              style={selectedRowStyle}
            >
              {meta}
            </Flex>
          </MessageRow>
        )
      ) : message.content === EMPTY_TEXT_CONTENT || message.content === NOT_REPORTED ? (
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
    </Container>
  );
});

function AssistantMeta({cost, duration}: {cost?: number; duration?: number}) {
  return (
    <TurnMeta
      metric={
        cost === undefined || cost <= 0 ? null : (
          <TurnMetaValue>
            <LLMCosts cost={cost} />
          </TurnMetaValue>
        )
      }
      duration={duration}
    />
  );
}

// Standalone row for an embeddings span — unlike tool calls and reasoning,
// embeddings aren't nested inside an assistant turn: they're positioned in the
// transcript by their own timestamp, so they render even when there's no
// generation span nearby (or at all) to attach them to.
const EmbeddingTurn = memo(function EmbeddingTurnImpl({
  message,
  isSelected,
}: {
  isSelected: boolean;
  message: ConversationMessage;
}) {
  const organization = useOrganization();
  const input = message.embeddingInput ?? '';
  const tokens = message.embeddingTokens;
  const [isOpen, setIsOpen] = useSelectionOpenState(isSelected ? message.nodeId : null);

  return (
    <MessageRow from="assistant" density="line" data-node-id={message.nodeId}>
      <CollapsibleChatRow
        open={isOpen}
        title={
          <Text
            size="sm"
            variant={message.embeddingHasError ? 'danger' : 'muted'}
            ellipsis
            monospace
          >
            {t('Creating embedding...')}
          </Text>
        }
        meta={
          <TurnMeta
            metric={
              tokens === undefined || tokens <= 0 ? null : (
                <TurnMetaValue>
                  <Count value={tokens} /> {t('tokens')}
                </TurnMetaValue>
              )
            }
            duration={message.duration}
          />
        }
        onOpenChange={open => {
          setIsOpen(open);
          trackAnalytics('conversations.detail.expand-embedding', {
            organization,
            expanded: open,
          });
        }}
      >
        <Flex>
          <Container paddingTop="xs" paddingBottom="xs" flex="1" minWidth={0}>
            <MessageText size="sm" align="left" variant="muted" monospace>
              <AIContentRenderer text={input} inline autoCollapseLimit={10} />
            </MessageText>
          </Container>
          <Container width={TURN_META_WIDTH} flexShrink={0} />
        </Flex>
      </CollapsibleChatRow>
    </MessageRow>
  );
});

// Standalone row for an evaluation span, positioned by its own timestamp like
// embeddings and styled like a tool call: the evaluator, a one-line result and
// its cost and duration. Selecting it opens the span detail with the questions,
// answers and raw messages.
const EvaluationTurn = memo(function EvaluationTurnImpl({
  message,
  node,
  isSelected,
  onSelectNode,
}: {
  isSelected: boolean;
  message: ConversationMessage;
  node: AITraceSpanNode | undefined;
  onSelectNode: (node: AITraceSpanNode) => void;
}) {
  const organization = useOrganization();
  // Spans often report `gen_ai.cost.total_tokens` as 0 when the API omits cost;
  // treat that as absent, like assistant turns.
  const cost = node
    ? getNumberAttr(node, SpanFields.GEN_AI_COST_TOTAL_TOKENS) || undefined
    : undefined;
  const evaluator =
    (node &&
      (getStringAttr(node, SpanFields.GEN_AI_REQUEST_MODEL) ||
        getStringAttr(node, SpanFields.GEN_AI_RESPONSE_MODEL))) ||
    t('evaluate');

  const selectEvaluation = () => {
    trackAnalytics('conversations.message.click-evaluation', {organization});
    if (node) {
      onSelectNode(node);
    }
  };

  return (
    <MessageRow from="assistant" density="line" data-node-id={message.nodeId}>
      <TranscriptSpanRow
        node={node}
        isSelected={isSelected}
        ariaLabel={t('Select evaluation %s', evaluator)}
        onSelect={selectEvaluation}
        tag={<ToolTag name={evaluator} hasError={node ? hasError(node) : false} />}
        preview={getEvaluationPreview(message.evaluation)}
        meta={<AssistantMeta cost={cost} duration={message.duration} />}
      />
    </MessageRow>
  );
});

// Standalone row for an extraction span, styled like an evaluation: the
// extractor, the values it found and its cost and duration. Selecting it opens
// the span detail with the source and every field.
const ExtractionTurn = memo(function ExtractionTurnImpl({
  message,
  node,
  isSelected,
  onSelectNode,
}: {
  isSelected: boolean;
  message: ConversationMessage;
  node: AITraceSpanNode | undefined;
  onSelectNode: (node: AITraceSpanNode) => void;
}) {
  const organization = useOrganization();
  const cost = node
    ? getNumberAttr(node, SpanFields.GEN_AI_COST_TOTAL_TOKENS) || undefined
    : undefined;
  const extractor =
    (node &&
      (getStringAttr(node, SpanFields.GEN_AI_REQUEST_MODEL) ||
        getStringAttr(node, SpanFields.GEN_AI_RESPONSE_MODEL))) ||
    t('extract');

  const selectExtraction = () => {
    trackAnalytics('conversations.message.click-extraction', {organization});
    if (node) {
      onSelectNode(node);
    }
  };

  return (
    <MessageRow from="assistant" density="line" data-node-id={message.nodeId}>
      <TranscriptSpanRow
        node={node}
        isSelected={isSelected}
        ariaLabel={t('Select extraction %s', extractor)}
        onSelect={selectExtraction}
        tag={<ToolTag name={extractor} hasError={node ? hasError(node) : false} />}
        preview={getExtractionPreview(message.extraction)}
        meta={<AssistantMeta cost={cost} duration={message.duration} />}
      />
    </MessageRow>
  );
});

// Standalone row for a memory operation span, positioned by its own timestamp
// like embeddings and styled like a tool call: the operation, a one-line
// preview and its duration. Selecting it opens the span detail with the full
// input and output.
const MemoryTurn = memo(function MemoryTurnImpl({
  message,
  node,
  isSelected,
  onSelectNode,
}: {
  isSelected: boolean;
  message: ConversationMessage;
  node: AITraceSpanNode | undefined;
  onSelectNode: (node: AITraceSpanNode) => void;
}) {
  const organization = useOrganization();
  const operation = message.memory?.operation ?? t('memory');

  const selectMemory = () => {
    trackAnalytics('conversations.message.click-memory', {organization});
    if (node) {
      onSelectNode(node);
    }
  };

  return (
    <MessageRow from="assistant" density="line" data-node-id={message.nodeId}>
      <TranscriptSpanRow
        node={node}
        isSelected={isSelected}
        ariaLabel={t('Select memory %s', operation)}
        onSelect={selectMemory}
        tag={<ToolTag name={operation} hasError={node ? hasError(node) : false} />}
        preview={getMemoryPreview(message.memory)}
        meta={<AssistantMeta duration={message.duration} />}
      />
    </MessageRow>
  );
});

function ReasoningSection({
  reasoning,
  meta,
}: {
  reasoning: string;
  meta?: React.ReactNode;
}) {
  const organization = useOrganization();

  // There is nothing to expand when the reasoning wasn't captured.
  if (reasoning === NOT_REPORTED) {
    return (
      <Flex align="center" gap="md" width="100%" minWidth={0} padding="sm 0">
        <Flex flex="1" minWidth={0}>
          <Text size="sm" variant="muted" ellipsis monospace>
            {t('Thinking...')} {reasoning}
          </Text>
        </Flex>
        <Container width={TURN_META_WIDTH} flexShrink={0}>
          {meta}
        </Container>
      </Flex>
    );
  }

  return (
    <CollapsibleChatRow
      meta={meta}
      title={isOpen => (
        <Text size="sm" variant="muted" ellipsis monospace>
          {t('Thinking...')} {isOpen ? null : <ScrubbedText>{reasoning}</ScrubbedText>}
        </Text>
      )}
      onOpenChange={open =>
        trackAnalytics('conversations.detail.expand-thinking', {
          organization,
          expanded: open,
        })
      }
    >
      <Flex>
        <Container paddingTop="xs" paddingBottom="xs" flex="1" minWidth={0}>
          <MessageText size="sm" align="left" variant="muted" monospace>
            <AIContentRenderer text={reasoning} inline autoCollapseLimit={10} />
          </MessageText>
        </Container>
        {/* Reasoning carries no metadata, but reserve the same column the tool
         * rows use so the content wraps at the same width. */}
        <Container width={TURN_META_WIDTH} flexShrink={0} />
      </Flex>
    </CollapsibleChatRow>
  );
}

// Collapsed by default: system prompts are long. Memoized since its only prop
// is a string, so selection changes never re-render the (possibly long) prompt.
const SystemPromptSection = memo(function SystemPromptSectionImpl({
  systemPrompt,
}: {
  systemPrompt: string;
}) {
  const organization = useOrganization();

  return (
    <CollapsibleChatRow
      title={isOpen => (
        <Text size="sm" variant="muted" ellipsis monospace>
          {t('System prompt')}{' '}
          {isOpen ? null : <ScrubbedText>{systemPrompt}</ScrubbedText>}
        </Text>
      )}
      onOpenChange={open =>
        trackAnalytics('conversations.detail.expand-system-prompt', {
          organization,
          expanded: open,
        })
      }
    >
      <Flex>
        <Container paddingTop="xs" paddingBottom="xs" flex="1" minWidth={0}>
          {/* Rendered like the span's Input tab: a boxed block that keeps the
           * prompt's line breaks, with a Pretty/Raw toggle. Not clipped, since
           * expanding the row already asked to see the whole prompt. */}
          <AIContentRenderer text={systemPrompt} clip={false} autoCollapseLimit={10} />
        </Container>
        <Container width={TURN_META_WIDTH} flexShrink={0} />
      </Flex>
    </CollapsibleChatRow>
  );
});

/**
 * Links to the docs for the conversation's platform, since the transcript was
 * built from placeholders because its inference spans captured no input or
 * output data.
 */
function NotReportedAlert({nodes}: {nodes: AITraceSpanNode[]}) {
  const projectSlug = useMemo(
    () => nodes.find(node => node.projectSlug)?.projectSlug,
    [nodes]
  );
  const {projects} = useProjects({slugs: projectSlug ? [projectSlug] : []});
  const platform = projectSlug
    ? projects.find(project => project.slug === projectSlug)?.platform
    : undefined;

  return (
    <ConversationMissingMessagesAlert
      dismissKey="conversation-not-reported-alert"
      docsLink={getAiInstrumentationDocsLink(platform)}
      padding="0 xl xl"
    />
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
  const invertedPlaceholderStyle = {backgroundColor: theme.tokens.background.primary};

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

  /* word-break: break-word is legacy for overflow-wrap: anywhere, which counts
   * toward min-content intrinsic size. Inherited into cells, it collapses them to
   * about one character: the table then fits any container, columns squish, and
   * its scroll container never overflows. Tables scroll on their own. */
  table {
    word-break: normal;
  }
`;
