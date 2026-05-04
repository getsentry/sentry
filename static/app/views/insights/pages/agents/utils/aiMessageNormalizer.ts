import {
  parseJsonWithFix,
  tryParseJsonRecursive,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

export interface AIMessage {
  content: any;
  role: string;
}

interface NormalizedResult {
  fixedInvalidJson: boolean;
  messages: AIMessage[] | null;
}

interface AIOutputResult {
  fixedInvalidJson: boolean;
  responseObject: string | null;
  responseText: string | null;
  toolCalls: string | null;
}

type RawMessage = {
  content?: any;
  parts?: any[];
  role?: string;
};

/**
 * Normalizes any AI attribute value into a list of messages.
 *
 * Accepts every shape the codebase supports on any attribute:
 * - parts-format array:     [{role, parts: [{type, text|content}, ...]}]
 * - content-format array:   [{role, content}]
 * - messages wrapper:       {messages: [...] | "[...]"}, optional `system`
 * - legacy {system, prompt}
 * - legacy {system, messages}
 * - plain string
 *
 * @param raw         Stringified attribute value.
 * @param defaultRole Role assigned when a message lacks one.
 */
export function normalizeToMessages(
  raw: string,
  {defaultRole}: {defaultRole: string}
): NormalizedResult {
  const {fixedInvalidJson, messages: rawMessages} = parseAndDetect(raw, defaultRole);

  const normalized: AIMessage[] = [];
  for (const msg of rawMessages) {
    const role = msg.role ?? defaultRole;
    const content = resolveMessageContent(msg, role);
    if (content === undefined || content === null || content === '') {
      continue;
    }
    normalized.push({role, content});
  }

  return {
    fixedInvalidJson,
    messages: normalized.length > 0 ? normalized : null,
  };
}

/**
 * Extracts assistant output from any AI attribute value, splitting it into
 * response text, structured objects, and tool calls.
 *
 * Role selection rule:
 * - If any message declares a role, select all with `role === 'assistant'`.
 * - Otherwise, take the last message.
 */
export function extractAssistantOutput(
  raw: string,
  {defaultRole}: {defaultRole: string}
): AIOutputResult {
  const {fixedInvalidJson, messages: rawMessages} = parseAndDetect(raw, defaultRole);

  const empty: AIOutputResult = {
    fixedInvalidJson,
    responseText: null,
    responseObject: null,
    toolCalls: null,
  };
  if (rawMessages.length === 0) {
    return empty;
  }

  const selected = selectAssistantMessages(rawMessages, defaultRole);

  const textParts: string[] = [];
  const toolCallParts: any[] = [];
  const objectParts: any[] = [];
  for (const msg of selected) {
    collectOutputExtras(msg, {textParts, toolCallParts, objectParts});
  }

  return {
    fixedInvalidJson,
    responseText: textParts.length > 0 ? textParts.join('\n') : null,
    responseObject:
      objectParts.length > 0
        ? JSON.stringify(objectParts.length === 1 ? objectParts[0] : objectParts)
        : null,
    toolCalls: toolCallParts.length > 0 ? JSON.stringify(toolCallParts) : null,
  };
}

function parseAndDetect(
  raw: string,
  defaultRole: string
): {fixedInvalidJson: boolean; messages: RawMessage[]} {
  if (!looksLikeJson(raw)) {
    return {
      fixedInvalidJson: false,
      messages: raw.trim() ? [{role: defaultRole, content: raw}] : [],
    };
  }

  const {parsed, fixedInvalidJson} = parseJsonWithFix(raw);
  if (parsed === null) {
    return {fixedInvalidJson, messages: []};
  }

  return {fixedInvalidJson, messages: detectShape(parsed, defaultRole)};
}

/**
 * Maps an already-parsed value onto a list of raw messages.
 */
function detectShape(value: any, defaultRole: string): RawMessage[] {
  if (typeof value === 'string') {
    return value.trim() ? [{role: defaultRole, content: value}] : [];
  }

  if (Array.isArray(value)) {
    return collectRawMessages(value, defaultRole);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  if ('messages' in value) {
    return unwrapMessagesField(value, defaultRole);
  }

  if ('prompt' in value) {
    return unwrapSystemPrompt(value);
  }

  const single = toRawMessage(value, defaultRole);
  return single ? [single] : [];
}

function collectRawMessages(items: any[], defaultRole: string): RawMessage[] {
  const out: RawMessage[] = [];
  for (const item of items) {
    const msg = toRawMessage(item, defaultRole);
    if (msg) {
      out.push(msg);
    }
  }
  return out;
}

/**
 * OpenRouter-style wrapper: `{messages: [...] | "[...]"}`.
 * Also supports an optional `system` prepended.
 */
function unwrapMessagesField(value: any, defaultRole: string): RawMessage[] {
  const result: RawMessage[] = [];
  if (value.system !== undefined && value.system !== null && value.system !== '') {
    result.push({role: 'system', content: value.system});
  }

  const inner = value.messages;
  if (Array.isArray(inner)) {
    result.push(...collectRawMessages(inner, defaultRole));
    return result;
  }
  if (typeof inner === 'string') {
    try {
      const innerParsed = JSON.parse(inner);
      result.push(...detectShape(innerParsed, defaultRole));
    } catch {
      if (inner.trim()) {
        result.push({role: defaultRole, content: inner});
      }
    }
  }
  return result;
}

/**
 * Legacy Vercel/AI SDK shape: `{system?, prompt}`.
 */
function unwrapSystemPrompt(value: any): RawMessage[] {
  const result: RawMessage[] = [];
  if (value.system !== undefined && value.system !== null && value.system !== '') {
    result.push({role: 'system', content: value.system});
  }
  if (value.prompt) {
    result.push({role: 'user', content: value.prompt});
  }
  return result;
}

function toRawMessage(item: any, defaultRole: string): RawMessage | null {
  if (typeof item === 'string') {
    return item.trim() ? {role: defaultRole, content: item} : null;
  }
  if (!item || typeof item !== 'object') {
    return null;
  }

  const role =
    typeof item.role === 'string' && item.role.length > 0 ? item.role : undefined;
  if (Array.isArray(item.parts)) {
    return {role: role ?? defaultRole, parts: item.parts};
  }
  if (item.content !== undefined) {
    return {role: role ?? defaultRole, content: item.content};
  }
  return null;
}

function resolveMessageContent(msg: RawMessage, role: string): any {
  if (msg.parts) {
    return collapseParts(msg.parts);
  }
  const parsed = tryParseJsonRecursive(msg.content);
  return role === 'tool' ? parsed : renderTextContent(parsed);
}

function renderTextContent(content: any): any {
  return Array.isArray(content) ? extractTextFromContentParts(content) : content;
}

/**
 * Collapses a parts array into the single content value a message should
 * render. Prefers text (plus file redaction placeholders); falls back to
 * structured objects, then tool_calls, then tool_call_responses.
 */
function collapseParts(parts: any[]): any {
  const hasText = parts.some((p: any) => p?.type === 'text');
  const hasFile = parts.some((p: any) => p?.type && FILE_CONTENT_PARTS.includes(p.type));
  if (hasText || hasFile) {
    return extractTextFromContentParts(parts);
  }

  const objectParts = parts.filter((p: any) => p?.type === 'object');
  if (objectParts.length > 0) {
    return objectParts.length === 1 ? objectParts[0] : objectParts;
  }

  const toolCalls = parts.filter((p: any) => p?.type === 'tool_call');
  if (toolCalls.length > 0) {
    return toolCalls;
  }

  const toolResponses = parts.filter((p: any) => p?.type === 'tool_call_response');
  if (toolResponses.length > 0) {
    return toolResponses.map((r: any) => r.result).join('\n');
  }

  return undefined;
}

function selectAssistantMessages(
  rawMessages: RawMessage[],
  defaultRole: string
): RawMessage[] {
  const hasRole = rawMessages.some(
    m => typeof m.role === 'string' && m.role.length > 0 && m.role !== defaultRole
  );
  if (hasRole) {
    return rawMessages.filter(m => m.role === 'assistant');
  }
  return [rawMessages[rawMessages.length - 1]!];
}

function collectOutputExtras(
  msg: RawMessage,
  buckets: {objectParts: any[]; textParts: string[]; toolCallParts: any[]}
): void {
  const {textParts, toolCallParts, objectParts} = buckets;

  if (msg.parts) {
    for (const part of msg.parts) {
      if (part?.type === 'text') {
        const text = part.content ?? part.text;
        if (typeof text === 'string' && text) {
          textParts.push(text);
        }
      } else if (part?.type === 'tool_call') {
        toolCallParts.push(part);
      } else if (part?.type === 'object') {
        objectParts.push(part);
      } else if (part?.type && FILE_CONTENT_PARTS.includes(part.type)) {
        textParts.push(
          `\n\n[redacted content of type "${part.mime_type ?? 'unknown'}"]\n\n`
        );
      }
    }
    return;
  }

  const content = msg.content;
  if (content === undefined || content === null) {
    return;
  }
  if (typeof content === 'string') {
    textParts.push(content);
  } else if (Array.isArray(content)) {
    const extracted = extractTextFromContentParts(content);
    if (extracted) {
      textParts.push(extracted);
    }
  } else if (typeof content === 'object') {
    objectParts.push(content);
  }
}

const FILE_CONTENT_PARTS = ['blob', 'uri', 'file'] as const;

function looksLikeJson(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  const first = trimmed[0];
  return first === '[' || first === '{' || first === '"';
}

function extractTextFromContentParts(parts: any[]): string {
  const texts: string[] = [];
  for (const part of parts) {
    if (!part || typeof part !== 'object') {
      continue;
    }
    if (part.type && FILE_CONTENT_PARTS.includes(part.type)) {
      texts.push(`\n\n[redacted content of type "${part.mime_type ?? 'unknown'}"]\n\n`);
      continue;
    }
    // Accept untyped items with `text` or `content` (older Anthropic-style
    // [{text: '...'}] arrays) as well as explicit `type: 'text'` parts.
    if (!part.type || part.type === 'text') {
      const text = part.text ?? part.content;
      if (typeof text === 'string' && text) {
        texts.push(text.trim());
      }
    }
  }
  return texts.join('\n');
}
