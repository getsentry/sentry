import {getDuration} from 'sentry/utils/duration/getDuration';
import {
  EMPTY_TEXT_CONTENT,
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
  role: 'user' | 'assistant';
  timestamp: number;
  agentName?: string;
  duration?: number;
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
    }

    lines.push(message.content);
    blocks.push(lines.join('\n\n'));
  }

  return blocks.join('\n\n---\n\n');
}
