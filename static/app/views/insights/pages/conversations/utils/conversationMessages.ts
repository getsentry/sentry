import {
  getStringAttr,
  hasError,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  getIsAiGenerationSpan,
  getIsExecuteToolSpan,
} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

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
  toolCalls?: ToolCall[];
  userEmail?: string;
}

interface RequestMessage {
  role: string;
  content?: string | Array<{text: string}>;
  parts?: Array<{type: string; content?: string; text?: string}>;
}

interface ConversationTurn {
  assistantContent: string | null;
  generation: AITraceSpanNode;
  toolCalls: ToolCall[];
  userContent: string | null;
  userEmail: string | undefined;
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
    const toolCalls = findToolCallsBetween(toolSpans, prevTimestamp, timestamp);

    turns.push({
      generation: node,
      toolCalls,
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

  for (const turn of turns) {
    const allToolCalls = [...pendingToolCalls, ...turn.toolCalls];

    if (turn.assistantContent) {
      result.push({...turn, toolCalls: allToolCalls});
      pendingToolCalls = [];
    } else if (turn.toolCalls.length > 0) {
      if (turn.userContent) {
        result.push({...turn, toolCalls: []});
      }
      pendingToolCalls = allToolCalls;
    } else if (turn.userContent) {
      result.push({...turn, toolCalls: allToolCalls});
      pendingToolCalls = [];
    }
  }

  return result;
}

export function turnsToMessages(turns: ConversationTurn[]): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  const seenUserContent = new Set<string>();
  const seenAssistantContent = new Set<string>();

  for (const turn of turns) {
    const timestamp = getNodeTimestamp(turn.generation);

    if (turn.userContent && !seenUserContent.has(turn.userContent)) {
      seenUserContent.add(turn.userContent);
      messages.push({
        id: `user-${turn.generation.id}`,
        role: 'user',
        content: turn.userContent,
        timestamp,
        nodeId: turn.generation.id,
        userEmail: turn.userEmail,
      });
    }

    if (turn.assistantContent && !seenAssistantContent.has(turn.assistantContent)) {
      seenAssistantContent.add(turn.assistantContent);
      messages.push({
        id: `assistant-${turn.generation.id}`,
        role: 'assistant',
        content: turn.assistantContent,
        timestamp: timestamp + 1,
        nodeId: turn.generation.id,
        toolCalls: turn.toolCalls.length > 0 ? turn.toolCalls : undefined,
      });
    }
  }

  messages.sort((a, b) => a.timestamp - b.timestamp);
  return messages;
}

export function findToolCallsBetween(
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
      const name = getStringAttr(span, SpanFields.GEN_AI_TOOL_NAME);
      return name ? {name, nodeId: span.id, hasError: hasError(span)} : null;
    })
    .filter((tc): tc is ToolCall => tc !== null);
}

export function parseUserContent(node: AITraceSpanNode): string | null {
  const inputMessages = getStringAttr(node, SpanFields.GEN_AI_INPUT_MESSAGES);

  const requestMessages =
    inputMessages || getStringAttr(node, SpanFields.GEN_AI_REQUEST_MESSAGES);

  if (!requestMessages) {
    return null;
  }

  try {
    const messagesArray: RequestMessage[] = JSON.parse(requestMessages);
    const userMessage = messagesArray.findLast(
      msg => msg.role === 'user' && (msg.content || msg.parts)
    );
    if (!userMessage) {
      return null;
    }
    return extractTextFromMessage(userMessage);
  } catch {
    return null;
  }
}

export function parseAssistantContent(node: AITraceSpanNode): string | null {
  const outputMessages = getStringAttr(node, SpanFields.GEN_AI_OUTPUT_MESSAGES);

  if (outputMessages) {
    try {
      const messagesArray: RequestMessage[] = JSON.parse(outputMessages);
      const assistantMessage = messagesArray.findLast(
        msg => msg.role === 'assistant' && (msg.content || msg.parts)
      );
      if (assistantMessage) {
        const content = extractTextFromMessage(assistantMessage);
        if (content) {
          return content;
        }
      }
    } catch {
      // Invalid JSON, fall through to legacy attributes
    }
  }

  const responseText = getStringAttr(node, SpanFields.GEN_AI_RESPONSE_TEXT);
  if (responseText) {
    return responseText;
  }

  return getStringAttr(node, SpanFields.GEN_AI_RESPONSE_OBJECT) ?? null;
}

export function getNodeTimestamp(node: AITraceSpanNode): number {
  return 'start_timestamp' in node.value ? node.value.start_timestamp : 0;
}

function getGenAiOpType(node: AITraceSpanNode): string | undefined {
  return getStringAttr(node, SpanFields.GEN_AI_OPERATION_TYPE);
}

export function extractTextFromMessage(msg: RequestMessage): string | null {
  if (Array.isArray(msg.parts)) {
    const textParts = msg.parts
      .filter(p => p.type === 'text')
      .map(p => p.content || p.text)
      .filter(Boolean);
    if (textParts.length > 0) {
      return textParts.join('\n');
    }
  }

  if (typeof msg.content === 'string') {
    return msg.content;
  }

  if (Array.isArray(msg.content)) {
    const texts = msg.content.map(p => p?.text).filter(Boolean);
    return texts.length > 0 ? texts.join('\n') : null;
  }

  return null;
}
