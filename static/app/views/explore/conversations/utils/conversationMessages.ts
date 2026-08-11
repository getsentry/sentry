import {getDuration} from 'sentry/utils/duration/getDuration';
import {
  EMPTY_TEXT_CONTENT,
  extractAssistantOutput,
  normalizeToMessages,
} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';
import {
  AGENT_NAME_FIELDS,
  getIsAiAgentNode,
  getNumberAttr,
  getStringAttr,
  hasError,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  getIsAiGenerationSpan,
  getIsExecuteToolSpan,
} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

const FILTERED = '[Filtered]';

/**
 * Content that is empty or only whitespace has nothing to render, so we treat
 * it as absent (`null`). This is the single guard that keeps blank message
 * bubbles — a small empty "cylinder" in the transcript — out of every consumer
 * of `extractMessagesFromNodes`. See TET-2670. Note `EMPTY_TEXT_CONTENT`
 * (`'(no value)'`) is a deliberate placeholder, not blank, so it is preserved.
 *
 * Content that is non-blank but renders to nothing as markdown (e.g. a bare
 * `\`\`\`` fence) is handled downstream by `AIContentRenderer`, which falls
 * back to the raw text rather than an empty bubble.
 */
function blankToNull(content: string | null): string | null {
  return content && content.trim().length > 0 ? content : null;
}

export interface ToolCall {
  hasError: boolean;
  name: string;
  nodeId: string;
  duration?: number;
}

export interface ConversationMessage {
  content: string;
  id: string;
  nodeId: string;
  role: 'user' | 'assistant' | 'embedding';
  timestamp: number;
  agentName?: string;
  duration?: number;
  embeddingHasError?: boolean;
  embeddingInput?: string;
  embeddingTokens?: number;
  modelName?: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  userEmail?: string;
}

interface ConversationTurn {
  assistantContent: string | null;
  generation: AITraceSpanNode;
  reasoning: string | null;
  toolCalls: ToolCall[];
  userContent: string | null;
  userEmail: string | undefined;
  // Input carries history (>1 message). Single-message inputs are never deduped.
  hasInputHistory?: boolean;
  toolSpanNodes?: AITraceSpanNode[];
  // User messages in the input history; a growing count marks a genuine repeat.
  userMessageCount?: number;
}

/**
 * Extracts conversation messages from trace spans.
 *
 * The turn builder assumes a single sequential think→tool loop, which breaks
 * when a conversation invokes sub-agents: their spans interleave in wall-clock
 * time, so building turns over all spans at once attributes one agent's tool
 * calls to another's generation and shuffles their rows together.
 *
 * Instead the span tree is processed as nested agent runs. A run — the top-level
 * conversation or a single agent span — is built from only the spans it owns
 * directly (those whose nearest ancestor agent is that run). Each nested agent
 * is spliced back in as its own sub-conversation, positioned by where it was
 * invoked and processed recursively, so a sub-agent appears between the parent
 * turns that surround it rather than being hoisted out of order. Nesting is
 * taken from the parent-span lineage, not wall-clock containment, since parallel
 * agents overlap in time.
 */
export function extractMessagesFromNodes(
  nodes: AITraceSpanNode[]
): ConversationMessage[] {
  return buildAgentRunMessages(ROOT_AGENT_RUN, indexAgentRuns(nodes));
}

/**
 * Builds the messages for a single agent run — the turn-construction pipeline:
 * 1. Partition spans into generation, tool, and embeddings spans
 * 2. Build conversation turns (user input + assistant output pairs)
 * 3. Merge turns that have no assistant response, carrying tool calls forward
 * 4. Convert turns to deduplicated, sorted messages
 * 5. Insert embeddings spans as their own standalone messages, positioned by
 *    timestamp — unlike tool calls, embeddings don't need a nearby generation
 *    to show up, so they never enter the turn-building pipeline above.
 */
function extractMessagesFromAgentRun(nodes: AITraceSpanNode[]): ConversationMessage[] {
  const {generationSpans, toolSpans, embeddingSpans} = partitionSpansByType(nodes);
  const turns = buildConversationTurns(generationSpans, toolSpans);
  const mergedTurns = mergeEmptyTurns(turns);
  const messages = [
    ...turnsToMessages(mergedTurns),
    ...embeddingSpansToMessages(embeddingSpans),
  ];
  messages.sort((a, b) => a.timestamp - b.timestamp);
  return messages;
}

const ROOT_AGENT_RUN = '__root__';

interface AgentRunIndex {
  // Agent span start timestamp keyed by agent id — positions a sub-conversation
  // within its parent run.
  agentStartById: Map<string, number>;
  // Agent spans nested directly in a run, keyed by the parent run id.
  childAgentsByRun: Map<string, AITraceSpanNode[]>;
  // Content spans (generation/tool/embedding) owned directly by a run, keyed by
  // run id — those whose nearest ancestor agent is that run.
  ownNodesByRun: Map<string, AITraceSpanNode[]>;
}

/**
 * Indexes the span tree into agent runs. Every span is attributed to the run of
 * its nearest ancestor agent (or ROOT when it has none); an agent span is a
 * child of the run it sits in and opens a run of its own. This is derived from
 * the parent-span lineage, matching how the timeline decides what to nest under
 * an agent.
 */
function indexAgentRuns(nodes: AITraceSpanNode[]): AgentRunIndex {
  const ownNodesByRun = new Map<string, AITraceSpanNode[]>();
  const childAgentsByRun = new Map<string, AITraceSpanNode[]>();
  const agentStartById = new Map<string, number>();

  const pushInto = (
    map: Map<string, AITraceSpanNode[]>,
    key: string,
    node: AITraceSpanNode
  ) => {
    const existing = map.get(key);
    if (existing) {
      existing.push(node);
    } else {
      map.set(key, [node]);
    }
  };

  for (const node of nodes) {
    // findParent looks at ancestors only, so for an agent node this is its
    // parent agent — the run it is nested in.
    const parentAgent = node.findParent(parent => getIsAiAgentNode(parent));
    const parentRunId = parentAgent?.id ?? ROOT_AGENT_RUN;

    if (getIsAiAgentNode(node)) {
      agentStartById.set(node.id, getNodeStartTimestamp(node));
      pushInto(childAgentsByRun, parentRunId, node);
    } else {
      pushInto(ownNodesByRun, parentRunId, node);
    }
  }

  return {ownNodesByRun, childAgentsByRun, agentStartById};
}

/**
 * Builds one run's messages and splices its sub-agent runs back in.
 *
 * The run's own spans go through the turn-construction pipeline; each nested
 * agent is expanded recursively and inserted as one atomic block at the agent's
 * start timestamp. Keeping a sub-conversation contiguous — rather than merging
 * its messages into the parent by timestamp — is what stops parallel agents from
 * re-interleaving.
 */
function buildAgentRunMessages(
  runId: string,
  index: AgentRunIndex
): ConversationMessage[] {
  const ownMessages = extractMessagesFromAgentRun(index.ownNodesByRun.get(runId) ?? []);
  const childAgents = index.childAgentsByRun.get(runId) ?? [];

  const items: Array<{messages: ConversationMessage[]; timestamp: number}> = [
    ...ownMessages.map(message => ({timestamp: message.timestamp, messages: [message]})),
    ...childAgents.map(agent => ({
      timestamp: index.agentStartById.get(agent.id) ?? 0,
      messages: buildAgentRunMessages(agent.id, index),
    })),
  ];

  items.sort((a, b) => a.timestamp - b.timestamp);
  return items.flatMap(item => item.messages);
}

export function partitionSpansByType(nodes: AITraceSpanNode[]): {
  embeddingSpans: AITraceSpanNode[];
  generationSpans: AITraceSpanNode[];
  toolSpans: AITraceSpanNode[];
} {
  const generationSpans: AITraceSpanNode[] = [];
  const toolSpans: AITraceSpanNode[] = [];
  const embeddingSpans: AITraceSpanNode[] = [];

  for (const node of nodes) {
    const opType = getGenAiOpType(node);
    // Embeddings are checked first: they don't get a dedicated
    // gen_ai.operation.type (it reports "ai_client"), so they're recognized by
    // their span op — or, once available, the embeddings-only input attribute.
    // Either way they must not fall through to generationSpans, where they'd be
    // dropped for having no chat content.
    if (getIsEmbeddingsNode(node)) {
      embeddingSpans.push(node);
    } else if (getIsAiGenerationSpan(opType)) {
      generationSpans.push(node);
    } else if (getIsExecuteToolSpan(opType)) {
      toolSpans.push(node);
    }
  }

  generationSpans.sort((a, b) => getNodeTimestamp(a) - getNodeTimestamp(b));
  toolSpans.sort((a, b) => getNodeTimestamp(a) - getNodeTimestamp(b));
  embeddingSpans.sort((a, b) => getNodeTimestamp(a) - getNodeTimestamp(b));

  return {generationSpans, toolSpans, embeddingSpans};
}

/**
 * Maps embeddings spans directly to standalone messages, independent of the
 * turn-building pipeline, so they render at their own timestamp regardless of
 * whether a generation span is nearby (or exists at all in the conversation).
 */
export function embeddingSpansToMessages(
  embeddingSpans: AITraceSpanNode[]
): ConversationMessage[] {
  const messages: ConversationMessage[] = [];

  for (const span of embeddingSpans) {
    const input = getStringAttr(span, SpanFields.GEN_AI_EMBEDDINGS_INPUT);

    // The input is the whole point of the row, so drop the span when it wasn't
    // captured rather than showing an empty "Creating embedding..." entry. (It's
    // absent until the bulk conversation fetch returns gen_ai.embeddings.input.)
    if (!input) {
      continue;
    }

    const start = getNodeStartTimestamp(span);
    const end = getNodeEndTimestamp(span);
    const tokens = getNumberAttr(span, SpanFields.GEN_AI_USAGE_TOTAL_TOKENS);

    messages.push({
      id: `embedding-${span.id}`,
      role: 'embedding',
      content: '',
      timestamp: getNodeTimestamp(span),
      nodeId: span.id,
      embeddingInput: input,
      embeddingTokens: tokens && tokens > 0 ? tokens : undefined,
      embeddingHasError: hasError(span),
      duration: end > start ? end - start : undefined,
    });
  }

  return messages;
}

export function buildConversationTurns(
  generationSpans: AITraceSpanNode[],
  toolSpans: AITraceSpanNode[]
): ConversationTurn[] {
  const turns: ConversationTurn[] = [];

  for (let i = 0; i < generationSpans.length; i++) {
    const node = generationSpans[i];
    if (!node) {
      continue;
    }

    const timestamp = getNodeTimestamp(node);
    const prevTimestamp = i > 0 ? getNodeTimestamp(generationSpans[i - 1]!) : 0;
    const userEmail = getStringAttr(node, SpanFields.USER_EMAIL);
    const toolCallSpans = findToolSpansBetween(toolSpans, prevTimestamp, timestamp);
    const toolCalls = toolCallSpans
      .map(span => {
        const name = getStringAttr(span, SpanFields.GEN_AI_TOOL_NAME);
        if (!name) {
          return null;
        }
        const toolStart = getNodeStartTimestamp(span);
        const toolEnd = getNodeEndTimestamp(span);
        const duration = toolEnd > toolStart ? toolEnd - toolStart : undefined;
        const toolCall: ToolCall = {
          name,
          nodeId: span.id,
          hasError: hasError(span),
          duration,
        };
        return toolCall;
      })
      .filter((tc): tc is ToolCall => tc !== null);

    const {content: assistantContent, reasoning} = parseAssistantContent(node);
    const inputStats = getInputMessageStats(node);
    turns.push({
      generation: node,
      toolCalls,
      toolSpanNodes: toolCallSpans,
      userContent: blankToNull(parseUserContent(node)),
      hasInputHistory: inputStats.totalMessageCount > 1,
      userMessageCount: inputStats.userMessageCount,
      assistantContent: blankToNull(assistantContent),
      reasoning: blankToNull(reasoning),
      userEmail,
    });
  }

  return turns;
}

export function mergeEmptyTurns(turns: ConversationTurn[]): ConversationTurn[] {
  const result: ConversationTurn[] = [];
  let pendingToolCalls: ToolCall[] = [];
  let pendingToolSpanNodes: AITraceSpanNode[] = [];

  for (const turn of turns) {
    const allToolCalls = [...pendingToolCalls, ...turn.toolCalls];
    const allToolSpanNodes = [...pendingToolSpanNodes, ...(turn.toolSpanNodes ?? [])];

    // A reasoning-bearing turn is displayable (see turnsToMessages), so it
    // anchors its own tool calls instead of being merged forward as empty.
    if (turn.assistantContent || turn.reasoning) {
      result.push({...turn, toolCalls: allToolCalls, toolSpanNodes: allToolSpanNodes});
      pendingToolCalls = [];
      pendingToolSpanNodes = [];
    } else if (allToolCalls.length > 0 || allToolSpanNodes.length > 0) {
      if (turn.userContent) {
        result.push({...turn, toolCalls: [], toolSpanNodes: []});
      }
      pendingToolCalls = allToolCalls;
      pendingToolSpanNodes = allToolSpanNodes;
    } else if (turn.userContent) {
      result.push({...turn, toolCalls: allToolCalls, toolSpanNodes: allToolSpanNodes});
      pendingToolCalls = [];
      pendingToolSpanNodes = [];
    }
  }

  // Flush any remaining pending tool calls as a tool-call-only turn
  const lastTurn = result.at(-1);
  if (pendingToolCalls.length > 0 && lastTurn) {
    result[result.length - 1] = {
      ...lastTurn,
      toolCalls: [...lastTurn.toolCalls, ...pendingToolCalls],
      toolSpanNodes: [...(lastTurn.toolSpanNodes ?? []), ...pendingToolSpanNodes],
    };
  }

  return result;
}

export function turnsToMessages(turns: ConversationTurn[]): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  const seenUserContent = new Set<string>();
  const seenAssistantContent = new Set<string>();
  let maxUserMessageCount = 0;

  for (const turn of turns) {
    const startTs = getNodeStartTimestamp(turn.generation);
    const genEnd = getNodeEndTimestamp(turn.generation);

    // Only cumulative inputs are deduped; single-message inputs are genuine turns.
    const hasHistory = turn.hasInputHistory ?? true;
    const userMessageCount = turn.userMessageCount ?? 0;
    const userCountGrew = userMessageCount > maxUserMessageCount;
    maxUserMessageCount = Math.max(maxUserMessageCount, userMessageCount);

    if (
      turn.userContent &&
      (turn.userContent === FILTERED ||
        turn.userContent === EMPTY_TEXT_CONTENT ||
        !hasHistory ||
        userCountGrew ||
        !seenUserContent.has(turn.userContent))
    ) {
      seenUserContent.add(turn.userContent);
      messages.push({
        id: `user-${turn.generation.id}`,
        role: 'user',
        content: turn.userContent,
        timestamp: startTs,
        nodeId: turn.generation.id,
        userEmail: turn.userEmail,
      });
    }

    const hasAssistantContent =
      turn.assistantContent &&
      (turn.assistantContent === FILTERED ||
        turn.assistantContent === EMPTY_TEXT_CONTENT ||
        !seenAssistantContent.has(turn.assistantContent));
    const hasToolCalls = turn.toolCalls.length > 0;

    if (hasAssistantContent || hasToolCalls || turn.reasoning) {
      if (turn.assistantContent) {
        seenAssistantContent.add(turn.assistantContent);
      }

      const toolSpanNodes = turn.toolSpanNodes ?? [];
      const lastToolEnd =
        toolSpanNodes.length > 0
          ? Math.max(...toolSpanNodes.map(getNodeEndTimestamp))
          : 0;
      const endTs = Math.max(genEnd, lastToolEnd);
      const duration = endTs > startTs ? endTs - startTs : undefined;

      let agentName: string | undefined;
      for (const field of AGENT_NAME_FIELDS) {
        agentName = getStringAttr(turn.generation, field);
        if (agentName) {
          break;
        }
      }
      const modelName = getStringAttr(turn.generation, SpanFields.GEN_AI_RESPONSE_MODEL);

      messages.push({
        id: `assistant-${turn.generation.id}`,
        role: 'assistant',
        content: turn.assistantContent ?? '',
        timestamp: endTs,
        nodeId: turn.generation.id,
        toolCalls: hasToolCalls ? turn.toolCalls : undefined,
        duration,
        agentName: agentName || undefined,
        modelName: modelName || undefined,
        reasoning: turn.reasoning || undefined,
      });
    }
  }

  messages.sort((a, b) => a.timestamp - b.timestamp);
  return messages;
}

function findToolSpansBetween(
  toolSpans: AITraceSpanNode[],
  startTime: number,
  endTime: number
): AITraceSpanNode[] {
  return toolSpans.filter(span => {
    const ts = getNodeTimestamp(span);
    return ts > startTime && ts < endTime;
  });
}

/**
 * Returns the last user message from `gen_ai.input.messages` or
 * `gen_ai.request.messages`. Tolerates every shape the unified normalizer
 * accepts (parts, content, {messages} wrapper, {system, prompt}, plain string).
 */
export function parseUserContent(node: AITraceSpanNode): string | null {
  const raw =
    getStringAttr(node, SpanFields.GEN_AI_INPUT_MESSAGES) ||
    getStringAttr(node, SpanFields.GEN_AI_REQUEST_MESSAGES);

  if (!raw) {
    return null;
  }
  if (raw === FILTERED) {
    return FILTERED;
  }

  const {messages} = normalizeToMessages(raw, {defaultRole: 'user'});
  if (!messages) {
    return null;
  }
  const userMessage = messages.findLast(m => m.role === 'user');
  if (!userMessage || typeof userMessage.content !== 'string') {
    return null;
  }
  return userMessage.content;
}

export interface InputMessageStats {
  totalMessageCount: number;
  userMessageCount: number;
}

/**
 * Counts messages in a generation's input to distinguish a genuine repeated
 * user message from a carry-forward. Returns zeroes for missing or scrubbed
 * input.
 */
export function getInputMessageStats(node: AITraceSpanNode): InputMessageStats {
  const raw =
    getStringAttr(node, SpanFields.GEN_AI_INPUT_MESSAGES) ||
    getStringAttr(node, SpanFields.GEN_AI_REQUEST_MESSAGES);

  if (!raw || raw === FILTERED) {
    return {totalMessageCount: 0, userMessageCount: 0};
  }

  const {messages} = normalizeToMessages(raw, {defaultRole: 'user'});
  if (!messages) {
    return {totalMessageCount: 0, userMessageCount: 0};
  }
  // System prompts are not conversation history; exclude them so a
  // non-cumulative SDK that always prepends a system message is still
  // recognised as single-message (non-cumulative) input.
  const nonSystem = messages.filter(m => m.role !== 'system');
  return {
    totalMessageCount: nonSystem.length,
    userMessageCount: nonSystem.filter(m => m.role === 'user').length,
  };
}

/**
 * Returns the assistant text response, checking `gen_ai.output.messages`
 * (every supported shape, including plain strings) and falling back to
 * `gen_ai.response.text` then `gen_ai.response.object`.
 */
export function parseAssistantContent(node: AITraceSpanNode): {
  content: string | null;
  reasoning: string | null;
} {
  const outputMessages = getStringAttr(node, SpanFields.GEN_AI_OUTPUT_MESSAGES);

  if (outputMessages) {
    if (outputMessages === FILTERED) {
      return {content: FILTERED, reasoning: null};
    }
    const extracted = extractAssistantOutput(outputMessages, {
      defaultRole: 'assistant',
    });
    if (extracted.responseText) {
      return {
        content: extracted.responseText,
        reasoning: extracted.reasoningText,
      };
    }
    // If tool calls or reasoning were found but no text, don't fall through to
    // response attributes — tool calls are rendered separately as badges and
    // reasoning is rendered in its own collapsible section.
    if (extracted.toolCalls || extracted.reasoningText) {
      return {content: null, reasoning: extracted.reasoningText};
    }
  }

  const responseText = getStringAttr(node, SpanFields.GEN_AI_RESPONSE_TEXT);
  if (responseText) {
    if (isToolCallOnlyContent(responseText)) {
      return {content: null, reasoning: null};
    }
    return {content: responseText, reasoning: null};
  }

  return {
    content: getStringAttr(node, SpanFields.GEN_AI_RESPONSE_OBJECT) ?? null,
    reasoning: null,
  };
}

/**
 * Returns true if the string is JSON containing only tool_call parts
 * and no actual text content (e.g. SDKs that stuff tool call output
 * into gen_ai.response.text).
 */
function isToolCallOnlyContent(raw: string): boolean {
  const extracted = extractAssistantOutput(raw, {defaultRole: 'assistant'});
  return !extracted.responseText && extracted.toolCalls !== null;
}

export function getNodeTimestamp(node: AITraceSpanNode): number {
  if ('end_timestamp' in node.value && typeof node.value.end_timestamp === 'number') {
    return node.value.end_timestamp;
  }
  if ('timestamp' in node.value && typeof node.value.timestamp === 'number') {
    return node.value.timestamp;
  }
  return 0;
}

function getNodeStartTimestamp(node: AITraceSpanNode): number {
  return 'start_timestamp' in node.value ? node.value.start_timestamp : 0;
}

function getNodeEndTimestamp(node: AITraceSpanNode): number {
  if ('end_timestamp' in node.value && typeof node.value.end_timestamp === 'number') {
    return node.value.end_timestamp;
  }
  if ('timestamp' in node.value && typeof node.value.timestamp === 'number') {
    return node.value.timestamp;
  }
  return 0;
}

function getGenAiOpType(node: AITraceSpanNode): string | undefined {
  return getStringAttr(node, SpanFields.GEN_AI_OPERATION_TYPE);
}

/**
 * Embeddings spans don't get a dedicated `gen_ai.operation.type` (it reports
 * `ai_client`), so they're recognized by their span op instead — falling back to
 * the embeddings-only input attribute when it's present.
 */
function getIsEmbeddingsNode(node: AITraceSpanNode): boolean {
  return (
    getStringAttr(node, SpanFields.SPAN_OP) === 'gen_ai.embeddings' ||
    Boolean(getStringAttr(node, SpanFields.GEN_AI_EMBEDDINGS_INPUT))
  );
}

// Prefix every line with `> ` so multi-line content forms one blockquote.
function toBlockquote(text: string): string {
  return text
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
}

export function messagesToMarkdown(messages: ConversationMessage[]): string {
  const blocks: string[] = [];

  for (const message of messages) {
    const lines: string[] = [];

    if (message.role === 'user') {
      const sender = message.userEmail || 'User';
      lines.push(`### ${sender}`);
      lines.push(message.content);
    } else if (message.role === 'embedding') {
      lines.push('### Embedding');
      lines.push(toBlockquote(message.embeddingInput ?? ''));
    } else {
      const sender = message.agentName || message.modelName || 'Assistant';
      const durationStr =
        message.duration !== undefined && message.duration > 0
          ? ` — ${getDuration(message.duration, 1, true)}`
          : '';
      lines.push(`### ${sender}${durationStr}`);

      if (message.toolCalls && message.toolCalls.length > 0) {
        const toolNames = message.toolCalls.map(tc => `\`${tc.name}\``).join(', ');
        lines.push(`> Called tools: ${toolNames}`);
      }

      if (message.reasoning) {
        lines.push(toBlockquote(`Thinking:\n${message.reasoning}`));
      }

      lines.push(message.content);
    }

    blocks.push(lines.join('\n\n'));
  }

  return blocks.join('\n\n---\n\n');
}
