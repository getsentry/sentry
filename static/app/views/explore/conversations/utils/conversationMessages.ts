import {stripAnnotations} from '@sentry/scraps/markdown/annotation';

import {getDuration} from 'sentry/utils/duration/getDuration';
import {
  EMPTY_TEXT_CONTENT,
  extractAssistantOutput,
  normalizeToMessages,
} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';
import {
  getNumberAttr,
  getStringAttr,
  hasError,
  resolveAgentName,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  evaluatedStateToText,
  getAnswerLabels,
  getNodeEvaluation,
  isEvaluationNode,
  type Evaluation,
} from 'sentry/views/insights/pages/agents/utils/evaluation';
import {
  getExtractedValueLabels,
  getNodeExtraction,
  isExtractionNode,
  type Extraction,
} from 'sentry/views/insights/pages/agents/utils/extraction';
import {
  getMemoryPreview,
  getNodeMemory,
  isMemoryNode,
  type Memory,
} from 'sentry/views/insights/pages/agents/utils/memory';
import {
  getIsAiGenerationSpan,
  getIsExecuteToolSpan,
} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

const FILTERED = '[Filtered]';

/**
 * Whether PII scrubbing replaced the whole value. In the conversation view the
 * placeholder carries marks that name the rule, see `markScrubbedValue`.
 */
function isFiltered(value: string): boolean {
  return stripAnnotations(value) === FILTERED;
}

/**
 * Placeholder for message content the SDK didn't record, used when a
 * conversation's generation spans captured no inputs or outputs at all.
 */
export const NOT_REPORTED = '<not reported>';

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
  kind?: 'tool';
}

/**
 * An agent span nested under another agent. It renders in its parent's
 * transcript as a single collapsed row and expands into its own transcript,
 * `messages`. When a tool span sits between the two agents (the agent was
 * called as a tool), the call replaces that tool call (`viaNodeId`) and its
 * transcript ends with the tool's result.
 */
export interface SubAgentCall {
  hasError: boolean;
  kind: 'subagent';
  /** The sub-agent's own LLM calls, not counting those of its sub-agents. */
  llmCallCount: number;
  messages: ConversationMessage[];
  name: string;
  nodeId: string;
  /** One-line summary for the collapsed row: the sub-agent's first input. */
  preview: string | null;
  duration?: number;
  viaNodeId?: string;
}

export type TurnCall = ToolCall | SubAgentCall;

export interface ConversationMessage {
  content: string;
  id: string;
  nodeId: string;
  role:
    | 'user'
    | 'assistant'
    | 'embedding'
    | 'evaluation'
    | 'extraction'
    | 'memory'
    | 'subagent';
  timestamp: number;
  agentName?: string;
  duration?: number;
  embeddingHasError?: boolean;
  embeddingInput?: string;
  embeddingTokens?: number;
  evaluation?: Evaluation;
  extraction?: Extraction;
  memory?: Memory;
  modelName?: string;
  reasoning?: string;
  /** A sub-agent that wasn't called through one of the transcript's tool calls. */
  subAgent?: SubAgentCall;
  toolCalls?: TurnCall[];
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
 * Extracts conversation messages from trace spans:
 * 1. Partition spans into generation, tool, and embeddings spans
 * 2. Build conversation turns (user input + assistant output pairs)
 * 3. Merge turns that have no assistant response, carrying tool calls forward.
 *    When no turn captured any content, fill placeholder turns instead so the
 *    conversation's structure still renders.
 * 4. Convert turns to deduplicated, sorted messages
 * 5. Insert embeddings spans as their own standalone messages, positioned by
 *    timestamp — unlike tool calls, embeddings don't need a nearby generation
 *    to show up, so they never enter the turn-building pipeline above.
 *
 * A conversation with agent spans runs that pipeline once per agent scope
 * instead (see `buildAgentHierarchyMessages`).
 */
export function extractMessagesFromNodes(
  nodes: AITraceSpanNode[]
): ConversationMessage[] {
  const enrichedNodes = enrichAgentMessages(nodes);
  if (enrichedNodes.some(isAgentNode)) {
    return buildAgentHierarchyMessages(enrichedNodes);
  }
  return buildScopeMessages(enrichedNodes, enrichedNodes);
}

/**
 * Runs the turn pipeline over `nodes`. `allNodes` resolves parent links for the
 * not-reported placeholders, which can reach outside `nodes`.
 */
function buildScopeMessages(
  nodes: AITraceSpanNode[],
  allNodes: AITraceSpanNode[]
): ConversationMessage[] {
  const {
    generationSpans,
    toolSpans,
    embeddingSpans,
    evaluationSpans,
    extractionSpans,
    memorySpans,
  } = partitionSpansByType(nodes);
  const turns = buildConversationTurns(generationSpans, toolSpans);
  const displayTurns = turns.some(hasTurnContent)
    ? mergeEmptyTurns(turns)
    : fillNotReportedTurns(turns, allNodes);
  const messages = [
    ...turnsToMessages(displayTurns),
    ...embeddingSpansToMessages(embeddingSpans),
    ...evaluationSpansToMessages(evaluationSpans),
    ...extractionSpansToMessages(extractionSpans),
    ...memorySpansToMessages(memorySpans),
  ];
  messages.sort((a, b) => a.timestamp - b.timestamp);
  return messages;
}

function nodeHasOwnMessages(node: AITraceSpanNode): boolean {
  return Boolean(
    getStringAttr(node, SpanFields.GEN_AI_INPUT_MESSAGES) ||
    getStringAttr(node, SpanFields.GEN_AI_REQUEST_MESSAGES) ||
    getStringAttr(node, SpanFields.GEN_AI_OUTPUT_MESSAGES) ||
    getStringAttr(node, SpanFields.GEN_AI_RESPONSE_TEXT)
  );
}

function cloneNodeWithAttrs(
  node: AITraceSpanNode,
  overrides: Record<string, string>
): AITraceSpanNode {
  return {
    ...node,
    attributes: {...node.attributes, ...overrides},
  } as AITraceSpanNode;
}

// The agent output interleaves assistant messages with `tool` result messages;
// only the assistant ones map to a generation span. Returns null for anything
// that isn't the expected array shape.
function parseAssistantSteps(rawOutput: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) {
    return null;
  }
  return parsed
    .filter(
      (message): message is {role?: string} =>
        typeof message === 'object' &&
        message !== null &&
        (message as {role?: string}).role === 'assistant'
    )
    .map(message => JSON.stringify([message]));
}

// Groups each agent's generation (ai_client) children under the agent's span id,
// sorted by start time so an agent's assistant output maps onto them in order.
function groupGenerationChildrenByAgent(
  nodes: AITraceSpanNode[]
): Map<string, AITraceSpanNode[]> {
  const childrenByAgentId = new Map<string, AITraceSpanNode[]>();
  for (const node of nodes) {
    const parentId = node.value?.parent_span_id;
    if (!parentId || !getIsAiGenerationSpan(getGenAiOpType(node))) {
      continue;
    }
    const siblings = childrenByAgentId.get(parentId);
    if (siblings) {
      siblings.push(node);
    } else {
      childrenByAgentId.set(parentId, [node]);
    }
  }
  for (const siblings of childrenByAgentId.values()) {
    siblings.sort((a, b) => getNodeStartTimestamp(a) - getNodeStartTimestamp(b));
  }
  return childrenByAgentId;
}

// Distributes one agent's input/output across its generation children. With one
// assistant message per generation they map 1:1, and the user input anchors the
// first child. Otherwise there is no safe per-step mapping, so fall back to the
// question on the first child and the whole output on the last.
function buildAgentChildOverrides(
  children: AITraceSpanNode[],
  rawInput: string | undefined,
  rawOutput: string
): Map<string, Record<string, string>> {
  const overrides = new Map<string, Record<string, string>>();
  const assistantSteps = parseAssistantSteps(rawOutput);

  if (assistantSteps && assistantSteps.length === children.length) {
    children.forEach((child, index) => {
      overrides.set(child.id, {
        [SpanFields.GEN_AI_OUTPUT_MESSAGES]: assistantSteps[index]!,
        ...(index === 0 && rawInput
          ? {[SpanFields.GEN_AI_INPUT_MESSAGES]: rawInput}
          : {}),
      });
    });
    return overrides;
  }

  if (rawInput) {
    overrides.set(children[0]!.id, {[SpanFields.GEN_AI_INPUT_MESSAGES]: rawInput});
  }
  const lastChild = children.at(-1)!;
  overrides.set(lastChild.id, {
    ...overrides.get(lastChild.id),
    [SpanFields.GEN_AI_OUTPUT_MESSAGES]: rawOutput,
  });
  return overrides;
}

/**
 * Some SDKs put messages on the agent span instead of its generation spans.
 * Backfill empty generation children so the standard transcript flow can use them.
 */
export function enrichAgentMessages(nodes: AITraceSpanNode[]): AITraceSpanNode[] {
  const childrenByAgentId = groupGenerationChildrenByAgent(nodes);
  const overridesById = new Map<string, Record<string, string>>();

  for (const node of nodes) {
    if (getGenAiOpType(node) !== 'agent') {
      continue;
    }

    const rawOutput = getStringAttr(node, SpanFields.GEN_AI_OUTPUT_MESSAGES);
    if (!rawOutput || isFiltered(rawOutput)) {
      continue;
    }

    const children = childrenByAgentId.get(node.id) ?? [];
    // Keep generation spans as the source when they have their own messages.
    if (children.length === 0 || children.some(nodeHasOwnMessages)) {
      continue;
    }

    const rawInput =
      getStringAttr(node, SpanFields.GEN_AI_INPUT_MESSAGES) ||
      getStringAttr(node, SpanFields.GEN_AI_REQUEST_MESSAGES);

    for (const [childId, overrides] of buildAgentChildOverrides(
      children,
      rawInput,
      rawOutput
    )) {
      overridesById.set(childId, overrides);
    }
  }

  if (overridesById.size === 0) {
    return nodes;
  }

  return nodes.map(node => {
    const overrides = overridesById.get(node.id);
    return overrides ? cloneNodeWithAttrs(node, overrides) : node;
  });
}

type SpanKind =
  | 'evaluation'
  | 'extraction'
  | 'memory'
  | 'embedding'
  | 'generation'
  | 'tool';

// Evaluations, extractions, embeddings and memory operations are recognized by
// gen_ai.operation.name first: until Relay sets a dedicated operation.type they
// report "ai_client" like LLM calls (and memory spans may be nested under tool
// calls), so matching by name keeps them out of the generation and tool kinds.
function getSpanKind(node: AITraceSpanNode): SpanKind | null {
  if (isEvaluationNode(node)) {
    return 'evaluation';
  }
  if (isExtractionNode(node)) {
    return 'extraction';
  }
  if (isMemoryNode(node)) {
    return 'memory';
  }
  if (isEmbeddingsNode(node)) {
    return 'embedding';
  }
  const opType = getGenAiOpType(node);
  if (getIsAiGenerationSpan(opType)) {
    return 'generation';
  }
  if (getIsExecuteToolSpan(opType)) {
    return 'tool';
  }
  return null;
}

export function partitionSpansByType(nodes: AITraceSpanNode[]): {
  embeddingSpans: AITraceSpanNode[];
  evaluationSpans: AITraceSpanNode[];
  extractionSpans: AITraceSpanNode[];
  generationSpans: AITraceSpanNode[];
  memorySpans: AITraceSpanNode[];
  toolSpans: AITraceSpanNode[];
} {
  const generationSpans: AITraceSpanNode[] = [];
  const toolSpans: AITraceSpanNode[] = [];
  const embeddingSpans: AITraceSpanNode[] = [];
  const evaluationSpans: AITraceSpanNode[] = [];
  const extractionSpans: AITraceSpanNode[] = [];
  const memorySpans: AITraceSpanNode[] = [];

  const spansByKind = {
    evaluation: evaluationSpans,
    extraction: extractionSpans,
    memory: memorySpans,
    embedding: embeddingSpans,
    generation: generationSpans,
    tool: toolSpans,
  } satisfies Record<SpanKind, AITraceSpanNode[]>;
  for (const node of nodes) {
    const kind = getSpanKind(node);
    if (kind) {
      spansByKind[kind].push(node);
    }
  }

  generationSpans.sort((a, b) => getNodeTimestamp(a) - getNodeTimestamp(b));
  toolSpans.sort((a, b) => getNodeTimestamp(a) - getNodeTimestamp(b));
  embeddingSpans.sort((a, b) => getNodeTimestamp(a) - getNodeTimestamp(b));
  evaluationSpans.sort((a, b) => getNodeTimestamp(a) - getNodeTimestamp(b));
  extractionSpans.sort((a, b) => getNodeTimestamp(a) - getNodeTimestamp(b));
  memorySpans.sort((a, b) => getNodeTimestamp(a) - getNodeTimestamp(b));

  return {
    generationSpans,
    toolSpans,
    embeddingSpans,
    evaluationSpans,
    extractionSpans,
    memorySpans,
  };
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

/**
 * Maps evaluation spans to standalone messages positioned by their own
 * timestamp, like embeddings. Parts that can't be read are left to the span
 * detail, which shows them raw.
 */
export function evaluationSpansToMessages(
  evaluationSpans: AITraceSpanNode[]
): ConversationMessage[] {
  return evaluationSpans.map(span => {
    const start = getNodeStartTimestamp(span);
    const end = getNodeEndTimestamp(span);
    return {
      id: `evaluation-${span.id}`,
      role: 'evaluation',
      content: '',
      timestamp: getNodeTimestamp(span),
      nodeId: span.id,
      duration: end > start ? end - start : undefined,
      evaluation: getNodeEvaluation(span) ?? undefined,
    };
  });
}

/**
 * Maps extraction spans to standalone messages positioned by their own
 * timestamp, like evaluations. Parts that can't be read are left to the span
 * detail, which shows them raw.
 */
export function extractionSpansToMessages(
  extractionSpans: AITraceSpanNode[]
): ConversationMessage[] {
  return extractionSpans.map(span => {
    const start = getNodeStartTimestamp(span);
    const end = getNodeEndTimestamp(span);
    return {
      id: `extraction-${span.id}`,
      role: 'extraction',
      content: '',
      timestamp: getNodeTimestamp(span),
      nodeId: span.id,
      duration: end > start ? end - start : undefined,
      extraction: getNodeExtraction(span) ?? undefined,
    };
  });
}

/**
 * Maps memory operation spans to standalone messages positioned by their own
 * timestamp, like embeddings and evaluations. The parsed memory drives the
 * collapsed preview and the expanded records; the records payload is opt-in, so
 * it may be absent until the bulk conversation fetch returns it.
 */
export function memorySpansToMessages(
  memorySpans: AITraceSpanNode[]
): ConversationMessage[] {
  return memorySpans.map(span => {
    const start = getNodeStartTimestamp(span);
    const end = getNodeEndTimestamp(span);
    return {
      id: `memory-${span.id}`,
      role: 'memory',
      content: '',
      timestamp: getNodeTimestamp(span),
      nodeId: span.id,
      duration: end > start ? end - start : undefined,
      memory: getNodeMemory(span) ?? undefined,
    };
  });
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

function hasTurnContent(turn: ConversationTurn): boolean {
  return Boolean(turn.userContent || turn.assistantContent || turn.reasoning);
}

interface SpanPlacement {
  /** The nearest agent ancestor, or null when there is none. */
  agent: AITraceSpanNode | null;
  /** The first tool span between the span and `agent`, if any. */
  viaTool: AITraceSpanNode | null;
}

// Walks up to the nearest `invoke_agent` span, noting the first tool span on
// the way. Stops on cycles and on parents outside the conversation.
function getSpanPlacement(
  node: AITraceSpanNode,
  nodesById: Map<string, AITraceSpanNode>
): SpanPlacement {
  const visited = new Set<string>([node.id]);
  let viaTool: AITraceSpanNode | null = null;
  let parentId = node.value?.parent_span_id;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = nodesById.get(parentId);
    if (!parent) {
      break;
    }
    if (isAgentNode(parent)) {
      return {agent: parent, viaTool};
    }
    if (!viaTool && getSpanKind(parent) === 'tool') {
      viaTool = parent;
    }
    parentId = parent.value?.parent_span_id;
  }
  return {agent: null, viaTool};
}

/**
 * Fills turns with `NOT_REPORTED` placeholders for a conversation whose spans
 * captured no message content. The generations of one agent span form one
 * exchange: a user placeholder on its first generation, an assistant
 * placeholder on its last, and tool calls in between. A sub-agent's
 * generations form their own exchange nested inside the calling agent's.
 * Generations without an agent span form a single exchange. Placeholders are
 * only shown where the token usage shows the content existed.
 *
 * This approximates the transcript's shape. Without content there's no way to
 * tell which generations produced assistant text or where new user messages
 * arrived, so a captured transcript can place bubbles differently, e.g. with
 * assistant output between tool calls or several exchanges within one run.
 */
function fillNotReportedTurns(
  turns: ConversationTurn[],
  nodes: AITraceSpanNode[]
): ConversationTurn[] {
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const agentIds = turns.map(
    turn => getSpanPlacement(turn.generation, nodesById).agent?.id ?? null
  );
  const firstIndexByAgent = new Map<string | null, number>();
  const lastIndexByAgent = new Map<string | null, number>();
  agentIds.forEach((agentId, index) => {
    if (!firstIndexByAgent.has(agentId)) {
      firstIndexByAgent.set(agentId, index);
    }
    lastIndexByAgent.set(agentId, index);
  });

  return turns.map((turn, index) => {
    const agentId = agentIds[index] ?? null;
    const isRunStart = firstIndexByAgent.get(agentId) === index;
    const isRunEnd = lastIndexByAgent.get(agentId) === index;
    const inputTokens = getNumberAttr(
      turn.generation,
      SpanFields.GEN_AI_USAGE_INPUT_TOKENS
    );
    const reasoningTokens = getNumberAttr(
      turn.generation,
      SpanFields.GEN_AI_USAGE_REASONING_OUTPUT_TOKENS
    );

    return {
      ...turn,
      userContent: isRunStart && inputTokens && inputTokens > 0 ? NOT_REPORTED : null,
      assistantContent: isRunEnd ? NOT_REPORTED : null,
      reasoning: reasoningTokens && reasoningTokens > 0 ? NOT_REPORTED : null,
    };
  });
}

// The main flow: spans of top-level agents and spans without any agent.
const MAIN_SCOPE = null;
type ScopeId = string | null;

/**
 * Builds the transcript of a conversation with agent spans, one agent scope at
 * a time:
 *
 * - Top-level agents (one per user message, typically) and spans without an
 *   agent form the main flow and share one dedup scope, as before.
 * - Each nested agent gets its own scope, built by the same pipeline, so
 *   parallel sub-agents neither interleave nor take each other's tool calls.
 *   It renders as a `SubAgentCall` in its parent's scope, replacing the tool
 *   call that started it or, without one, at its own start time.
 */
function buildAgentHierarchyMessages(nodes: AITraceSpanNode[]): ConversationMessage[] {
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const placements = new Map(
    nodes.map(node => [node.id, getSpanPlacement(node, nodesById)])
  );

  const getParentAgent = (node: AITraceSpanNode) =>
    placements.get(node.id)?.agent ?? null;

  // Nested agents get their own scope when they can be reached from a top-level
  // agent. Agents whose parent chain loops back on itself can't, so they are
  // treated as top-level rather than dropped.
  const nestedAgents: Array<{agent: AITraceSpanNode; parent: AITraceSpanNode}> = [];
  for (const node of nodes) {
    const parent = getParentAgent(node);
    if (isAgentNode(node) && parent) {
      nestedAgents.push({agent: node, parent});
    }
  }
  const nestedAgentIds = new Set(nestedAgents.map(({agent}) => agent.id));
  const childAgentsById = new Map<string, AITraceSpanNode[]>();
  const pending: AITraceSpanNode[] = [];
  for (const {agent, parent} of nestedAgents) {
    pushToMap(childAgentsById, parent.id, agent);
    if (!nestedAgentIds.has(parent.id)) {
      pending.push(agent);
    }
  }
  const reachable = new Set<string>();
  for (let agent = pending.pop(); agent; agent = pending.pop()) {
    if (!reachable.has(agent.id)) {
      reachable.add(agent.id);
      pending.push(...(childAgentsById.get(agent.id) ?? []));
    }
  }
  const getScopeId = (agent: AITraceSpanNode | null): ScopeId =>
    agent && reachable.has(agent.id) ? agent.id : MAIN_SCOPE;

  const subAgentsByScope = new Map<ScopeId, AITraceSpanNode[]>();
  for (const {agent, parent} of nestedAgents) {
    if (reachable.has(agent.id)) {
      pushToMap(subAgentsByScope, getScopeId(parent), agent);
    }
  }

  const nodesByScope = new Map<ScopeId, AITraceSpanNode[]>();
  for (const node of nodes) {
    if (!isAgentNode(node)) {
      pushToMap(nodesByScope, getScopeId(getParentAgent(node)), node);
    }
  }

  const buildScope = (scopeId: ScopeId): ConversationMessage[] => {
    const subAgentCalls = (subAgentsByScope.get(scopeId) ?? []).map(agent =>
      toSubAgentCall(
        agent,
        placements.get(agent.id)?.viaTool ?? null,
        buildScope(agent.id),
        (nodesByScope.get(agent.id) ?? []).filter(
          node => getSpanKind(node) === 'generation'
        ).length
      )
    );
    return attachSubAgentCalls(
      buildScopeMessages(nodesByScope.get(scopeId) ?? [], nodes),
      subAgentCalls,
      nodesById
    );
  };

  return buildScope(MAIN_SCOPE);
}

function pushToMap<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const values = map.get(key);
  if (values) {
    values.push(value);
  } else {
    map.set(key, [value]);
  }
}

function getNodeDuration(node: AITraceSpanNode): number | undefined {
  const start = getNodeStartTimestamp(node);
  const end = getNodeEndTimestamp(node);
  return end > start ? end - start : undefined;
}

function getToolResult(tool: AITraceSpanNode): string | null {
  return blankToNull(
    getStringAttr(tool, 'gen_ai.tool.call.result') ||
      getStringAttr(tool, 'gen_ai.tool.output') ||
      null
  );
}

// When the sub-agent ran as a tool, the tool's result is what it returned to
// its parent, so the transcript ends with it.
function toSubAgentCall(
  agent: AITraceSpanNode,
  viaTool: AITraceSpanNode | null,
  messages: ConversationMessage[],
  llmCallCount: number
): SubAgentCall {
  const name = resolveAgentName(agent.attributes ?? {}) || agent.description || 'agent';
  const result = viaTool ? getToolResult(viaTool) : null;
  return {
    kind: 'subagent',
    nodeId: agent.id,
    name,
    llmCallCount,
    hasError: hasError(agent),
    duration: getNodeDuration(agent),
    preview:
      messages.find(message => message.role === 'user')?.content ??
      blankToNull(parseUserContent(agent)),
    messages:
      viaTool && result
        ? [
            ...messages,
            {
              id: `result-${viaTool.id}`,
              role: 'assistant',
              content: result,
              nodeId: viaTool.id,
              timestamp: getNodeEndTimestamp(viaTool),
              agentName: name,
            },
          ]
        : messages,
    viaNodeId: viaTool?.id,
  };
}

/**
 * Places sub-agents in a scope's messages. A sub-agent called through a tool
 * replaces that tool call in its turn. One without a tool call, or whose tool
 * call isn't in the transcript, joins the calls of the turn that follows it,
 * ordered by start time with the tool calls that ran around it. Only one that
 * no turn follows becomes a message of its own.
 */
function attachSubAgentCalls(
  messages: ConversationMessage[],
  calls: SubAgentCall[],
  nodesById: Map<string, AITraceSpanNode>
): ConversationMessage[] {
  if (calls.length === 0) {
    return messages;
  }

  const startOf = (call: TurnCall) => {
    const node = nodesById.get(call.nodeId);
    return node ? getNodeStartTimestamp(node) : 0;
  };
  const toolIdsInTranscript = new Set(
    messages.flatMap(message => message.toolCalls?.map(call => call.nodeId) ?? [])
  );

  const callsByToolId = new Map<string, SubAgentCall[]>();
  const callsByMessageId = new Map<string, SubAgentCall[]>();
  const unplacedCalls: SubAgentCall[] = [];
  for (const call of calls) {
    if (call.viaNodeId && toolIdsInTranscript.has(call.viaNodeId)) {
      pushToMap(callsByToolId, call.viaNodeId, call);
      continue;
    }
    const nextTurn = messages.find(
      message => message.role === 'assistant' && message.timestamp > startOf(call)
    );
    if (nextTurn) {
      pushToMap(callsByMessageId, nextTurn.id, call);
    } else {
      unplacedCalls.push(call);
    }
  }

  const result = messages.map(message => {
    const joiningCalls = callsByMessageId.get(message.id) ?? [];
    if (
      joiningCalls.length === 0 &&
      !message.toolCalls?.some(call => callsByToolId.has(call.nodeId))
    ) {
      return message;
    }
    const toolCalls = [
      ...(message.toolCalls ?? []).flatMap(
        call => callsByToolId.get(call.nodeId) ?? [call]
      ),
      ...joiningCalls,
    ].sort((a, b) => startOf(a) - startOf(b));
    return {...message, toolCalls};
  });

  for (const call of unplacedCalls) {
    result.push({
      id: `subagent-${call.nodeId}`,
      role: 'subagent',
      content: '',
      nodeId: call.nodeId,
      timestamp: startOf(call),
      duration: call.duration,
      subAgent: call,
    });
  }

  result.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}

/**
 * Whether `nodeId` is one of the call's spans: the call itself or, for a
 * sub-agent, the tool it replaced or any span in its transcript.
 */
export function callContainsNode(call: TurnCall, nodeId: string): boolean {
  if (call.nodeId === nodeId) {
    return true;
  }
  if (!isSubAgentCall(call)) {
    return false;
  }
  if (call.viaNodeId === nodeId) {
    return true;
  }
  return call.messages.some(message => messageContainsNode(message, nodeId));
}

export function isSubAgentCall(call: TurnCall): call is SubAgentCall {
  return call.kind === 'subagent';
}

/** Whether `nodeId` is the message's span or one of its calls' spans. */
function messageContainsNode(message: ConversationMessage, nodeId: string): boolean {
  if (message.nodeId === nodeId) {
    return true;
  }
  if (message.subAgent && callContainsNode(message.subAgent, nodeId)) {
    return true;
  }
  return message.toolCalls?.some(call => callContainsNode(call, nodeId)) ?? false;
}

/** Whether any message, including those inside sub-agents, matches. */
export function someMessageDeep(
  messages: ConversationMessage[],
  predicate: (message: ConversationMessage) => boolean
): boolean {
  return messages.some(message => {
    if (predicate(message)) {
      return true;
    }
    const subAgents = [
      ...(message.subAgent ? [message.subAgent] : []),
      ...(message.toolCalls ?? []).filter(isSubAgentCall),
    ];
    return subAgents.some(subAgent => someMessageDeep(subAgent.messages, predicate));
  });
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
      (isFiltered(turn.userContent) ||
        turn.userContent === EMPTY_TEXT_CONTENT ||
        turn.userContent === NOT_REPORTED ||
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
      (isFiltered(turn.assistantContent) ||
        turn.assistantContent === EMPTY_TEXT_CONTENT ||
        turn.assistantContent === NOT_REPORTED ||
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

      const agentName = resolveAgentName(turn.generation.attributes ?? {});
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
  if (isFiltered(raw)) {
    return raw;
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

interface InputMessageStats {
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

  if (!raw || isFiltered(raw)) {
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
    if (isFiltered(outputMessages)) {
      return {content: outputMessages, reasoning: null};
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
  return getNodeTimestamp(node);
}

function getGenAiOpType(node: AITraceSpanNode): string | undefined {
  return getStringAttr(node, SpanFields.GEN_AI_OPERATION_TYPE);
}

function isAgentNode(node: AITraceSpanNode): boolean {
  return getGenAiOpType(node) === 'agent';
}

function isEmbeddingsNode(node: AITraceSpanNode): boolean {
  return getStringAttr(node, SpanFields.GEN_AI_OPERATION_NAME) === 'embeddings';
}

// Prefix every line with `> ` so multi-line content forms one blockquote.
function toBlockquote(text: string): string {
  return text
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
}

function evaluationToMarkdown(evaluation: Evaluation | undefined): string[] {
  const lines: string[] = [];
  const state = evaluation?.input?.state;
  if (state) {
    lines.push(toBlockquote(evaluatedStateToText(state)));
  }
  const answers = getAnswerLabels(
    evaluation?.answers ?? [],
    evaluation?.input?.questions
  ).map(([key, label]) => `- ${key}: ${label}`);
  if (answers.length > 0) {
    lines.push(answers.join('\n'));
  }
  return lines;
}

function extractionToMarkdown(extraction: Extraction | undefined): string[] {
  const lines: string[] = [];
  const source = extraction?.input?.source;
  if (source) {
    lines.push(toBlockquote(source));
  }
  const values = getExtractedValueLabels(extraction?.answers ?? []).map(
    ([key, label]) => `- ${key}: ${label}`
  );
  if (values.length > 0) {
    lines.push(values.join('\n'));
  }
  return lines;
}

function formatMarkdownDuration(duration: number | undefined): string {
  return duration !== undefined && duration > 0
    ? ` — ${getDuration(duration, 1, true)}`
    : '';
}

function subAgentToMarkdown(call: SubAgentCall): string {
  const lines = [`### Sub-agent: ${call.name}${formatMarkdownDuration(call.duration)}`];
  if (call.messages.length > 0) {
    lines.push(toBlockquote(messagesToMarkdown(call.messages)));
  }
  return lines.join('\n\n');
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
    } else if (message.role === 'evaluation') {
      lines.push('### Evaluation');
      lines.push(...evaluationToMarkdown(message.evaluation));
    } else if (message.role === 'extraction') {
      lines.push('### Extraction');
      lines.push(...extractionToMarkdown(message.extraction));
    } else if (message.role === 'memory') {
      lines.push('### Memory');
      const summary = [message.memory?.operation, getMemoryPreview(message.memory)]
        .filter(Boolean)
        .join(': ');
      lines.push(toBlockquote(summary));
    } else if (message.subAgent) {
      lines.push(subAgentToMarkdown(message.subAgent));
    } else {
      const sender = message.agentName || message.modelName || 'Assistant';
      lines.push(`### ${sender}${formatMarkdownDuration(message.duration)}`);

      const calls = message.toolCalls ?? [];
      const toolNames = calls
        .filter(call => !isSubAgentCall(call))
        .map(call => `\`${call.name}\``);
      if (toolNames.length > 0) {
        lines.push(`> Called tools: ${toolNames.join(', ')}`);
      }
      for (const call of calls) {
        if (isSubAgentCall(call)) {
          lines.push(toBlockquote(subAgentToMarkdown(call)));
        }
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
