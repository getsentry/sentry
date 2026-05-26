import {
  extractAssistantOutput,
  normalizeToMessages,
} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';
import {
  AGENT_NAME_FIELDS,
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

export interface ToolCall {
  hasError: boolean;
  name: string;
  nodeId: string;
}

export interface ConversationMessage {
  content: string;
  id: string;
  nodeId: string;
  role: 'user' | 'assistant';
  timestamp: number;
  agentName?: string;
  duration?: number;
  modelName?: string;
  toolCalls?: ToolCall[];
  userEmail?: string;
}

interface ConversationTurn {
  assistantContent: string | null;
  generation: AITraceSpanNode;
  toolCalls: ToolCall[];
  userContent: string | null;
  userEmail: string | undefined;
  toolSpanNodes?: AITraceSpanNode[];
}

/**
 * Extracts conversation messages from trace spans:
 * 1. Partition spans into generation and tool spans
 * 2. Build conversation turns (user input + assistant output pairs)
 * 3. Merge turns that have no assistant response, carrying tool calls forward
 * 4. Convert turns to deduplicated, sorted messages
 */
export function extractMessagesFromNodes(
  nodes: AITraceSpanNode[]
): ConversationMessage[] {
  const {generationSpans, toolSpans} = partitionSpansByType(nodes);
  const turns = buildConversationTurns(generationSpans, toolSpans);
  const mergedTurns = mergeEmptyTurns(turns);
  return turnsToMessages(mergedTurns);
}

export function partitionSpansByType(nodes: AITraceSpanNode[]): {
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
        return name ? {name, nodeId: span.id, hasError: hasError(span)} : null;
      })
      .filter((tc): tc is ToolCall => tc !== null);

    turns.push({
      generation: node,
      toolCalls,
      toolSpanNodes: toolCallSpans,
      userContent: parseUserContent(node),
      assistantContent: parseAssistantContent(node),
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

    if (turn.assistantContent) {
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

  return result;
}

export function turnsToMessages(turns: ConversationTurn[]): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  const seenUserContent = new Set<string>();
  const seenAssistantContent = new Set<string>();

  for (const turn of turns) {
    const startTs = getNodeStartTimestamp(turn.generation);
    const genEnd = getNodeEndTimestamp(turn.generation);

    if (
      turn.userContent &&
      (turn.userContent === FILTERED || !seenUserContent.has(turn.userContent))
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

    if (
      turn.assistantContent &&
      (turn.assistantContent === FILTERED ||
        !seenAssistantContent.has(turn.assistantContent))
    ) {
      seenAssistantContent.add(turn.assistantContent);

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
        content: turn.assistantContent,
        timestamp: endTs,
        nodeId: turn.generation.id,
        toolCalls: turn.toolCalls.length > 0 ? turn.toolCalls : undefined,
        duration,
        agentName: agentName || undefined,
        modelName: modelName || undefined,
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

/**
 * Returns the assistant text response, checking `gen_ai.output.messages`
 * (every supported shape, including plain strings) and falling back to
 * `gen_ai.response.text` then `gen_ai.response.object`.
 */
export function parseAssistantContent(node: AITraceSpanNode): string | null {
  const outputMessages = getStringAttr(node, SpanFields.GEN_AI_OUTPUT_MESSAGES);

  if (outputMessages) {
    if (outputMessages === FILTERED) {
      return FILTERED;
    }
    const extracted = extractAssistantOutput(outputMessages, {
      defaultRole: 'assistant',
    });
    if (extracted.responseText) {
      return extracted.responseText;
    }
  }

  const responseText = getStringAttr(node, SpanFields.GEN_AI_RESPONSE_TEXT);
  if (responseText) {
    return responseText;
  }

  return getStringAttr(node, SpanFields.GEN_AI_RESPONSE_OBJECT) ?? null;
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
