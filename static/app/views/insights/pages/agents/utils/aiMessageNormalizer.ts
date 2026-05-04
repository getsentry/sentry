import {
  parseJsonWithFix,
  tryParseJsonRecursive,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

export interface AIMessage {
  content: unknown;
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
  content?: unknown;
  parts?: unknown[];
  role?: string;
  roleExplicit?: boolean;
};

/**
 * Normalizes AI attribute values into a list of messages.
 *
 * Accepts every shape the codebase supports on supported attributes:
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
 * Extracts assistant output from AI attribute values, splitting it into
 * response text, structured objects, and tool calls.
 *
 * Role selection rule:
 * - If at least one message declares a role, select all with `role === 'assistant'`.
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

  const selected = selectAssistantMessages(rawMessages);

  const textParts: string[] = [];
  const toolCallParts: unknown[] = [];
  const objectParts: unknown[] = [];
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

  const {parsed, fixedInvalidJson}: {fixedInvalidJson: boolean; parsed: unknown} =
    parseJsonWithFix(raw);
  if (parsed === null) {
    return {fixedInvalidJson, messages: []};
  }

  return {fixedInvalidJson, messages: detectShape(parsed, defaultRole)};
}

/**
 * Maps an already-parsed value onto a list of raw messages.
 */
function detectShape(value: unknown, defaultRole: string): RawMessage[] {
  if (typeof value === 'string') {
    return value.trim() ? [{role: defaultRole, content: value}] : [];
  }

  if (Array.isArray(value)) {
    return collectRawMessages(value, defaultRole);
  }

  if (!isRecord(value)) {
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

function collectRawMessages(items: unknown[], defaultRole: string): RawMessage[] {
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
function unwrapMessagesField(value: UnknownRecord, defaultRole: string): RawMessage[] {
  const result: RawMessage[] = [];
  const system = value.system;
  if (system) {
    result.push({role: 'system', roleExplicit: true, content: system});
  }

  const inner = value.messages;
  if (Array.isArray(inner)) {
    result.push(...collectRawMessages(inner, defaultRole));
    return result;
  }
  if (typeof inner === 'string') {
    try {
      const innerParsed: unknown = JSON.parse(inner);
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
function unwrapSystemPrompt(value: UnknownRecord): RawMessage[] {
  const result: RawMessage[] = [];
  const system = value.system;
  if (system) {
    result.push({role: 'system', roleExplicit: true, content: system});
  }
  if (value.prompt) {
    result.push({role: 'user', roleExplicit: true, content: value.prompt});
  }
  return result;
}

function toRawMessage(item: unknown, defaultRole: string): RawMessage | null {
  if (typeof item === 'string') {
    return item.trim() ? {role: defaultRole, content: item} : null;
  }
  if (!isRecord(item)) {
    return null;
  }

  const role = getStringField(item, 'role');
  if (Array.isArray(item.parts)) {
    return {
      role: role ?? defaultRole,
      roleExplicit: role !== undefined,
      parts: item.parts,
    };
  }
  if (item.content !== undefined) {
    return {
      role: role ?? defaultRole,
      roleExplicit: role !== undefined,
      content: item.content,
    };
  }
  return null;
}

function resolveMessageContent(msg: RawMessage, role: string): unknown {
  if (msg.parts) {
    return collapseParts(msg.parts);
  }
  const parsed = tryParseJsonRecursive(msg.content);
  return role === 'tool' ? parsed : renderTextContent(parsed);
}

function renderTextContent(content: unknown): unknown {
  return Array.isArray(content) ? extractTextFromContentParts(content) : content;
}

/**
 * Collapses a parts array into the single content value a message should
 * render. Prefers text (plus file redaction placeholders); falls back to
 * structured objects, then tool_calls, then tool_call_responses.
 */
function collapseParts(parts: unknown[]): unknown {
  const hasText = parts.some(part => getPartType(part) === 'text');
  const hasFile = parts.some(part => isFileContentPartType(getPartType(part)));
  if (hasText || hasFile) {
    return extractTextFromContentParts(parts);
  }

  const objectParts = parts.filter(part => getPartType(part) === 'object');
  if (objectParts.length > 0) {
    return objectParts.length === 1 ? objectParts[0] : objectParts;
  }

  const toolCalls = parts.filter(part => getPartType(part) === 'tool_call');
  if (toolCalls.length > 0) {
    return toolCalls;
  }

  const toolResponses = parts.filter(part => getPartType(part) === 'tool_call_response');
  if (toolResponses.length > 0) {
    return toolResponses
      .map(response => (isRecord(response) ? response.result : undefined))
      .join('\n');
  }

  return undefined;
}

function selectAssistantMessages(rawMessages: RawMessage[]): RawMessage[] {
  const hasRole = rawMessages.some(m => m.roleExplicit === true);
  if (hasRole) {
    return rawMessages.filter(m => m.role === 'assistant');
  }
  return [rawMessages[rawMessages.length - 1]!];
}

function collectOutputExtras(
  msg: RawMessage,
  buckets: {objectParts: unknown[]; textParts: string[]; toolCallParts: unknown[]}
): void {
  const {textParts, toolCallParts, objectParts} = buckets;

  if (msg.parts) {
    for (const part of msg.parts) {
      const partType = getPartType(part);
      if (partType === 'text' && isRecord(part)) {
        const text = getStringField(part, 'content') ?? getStringField(part, 'text');
        if (text) {
          textParts.push(text);
        }
      } else if (partType === 'tool_call') {
        toolCallParts.push(part);
      } else if (partType === 'object') {
        objectParts.push(part);
      } else if (isFileContentPartType(partType) && isRecord(part)) {
        textParts.push(`\n\n[redacted content of type "${getMimeType(part)}"]\n\n`);
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
  } else if (content !== null && typeof content === 'object') {
    objectParts.push(content);
  }
}

const FILE_CONTENT_PARTS = ['blob', 'uri', 'file'] as const;
const FILE_CONTENT_PART_TYPES = new Set<string>(FILE_CONTENT_PARTS);
type FileContentPartType = (typeof FILE_CONTENT_PARTS)[number];
type UnknownRecord = Record<string, unknown>;

function looksLikeJson(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  const first = trimmed[0];
  return first === '[' || first === '{' || first === '"';
}

function extractTextFromContentParts(parts: unknown[]): string {
  const texts: string[] = [];
  for (const part of parts) {
    if (!isRecord(part)) {
      continue;
    }

    const partType = getPartType(part);
    if (isFileContentPartType(partType)) {
      texts.push(`\n\n[redacted content of type "${getMimeType(part)}"]\n\n`);
      continue;
    }
    // Accept untyped items with `text` or `content` (older Anthropic-style
    // [{text: '...'}] arrays) as well as explicit `type: 'text'` parts.
    if (!partType || partType === 'text') {
      const text = getStringField(part, 'text') ?? getStringField(part, 'content');
      if (text) {
        texts.push(text.trim());
      }
    }
  }
  return texts.join('\n');
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getStringField(record: UnknownRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getPartType(value: unknown): string | undefined {
  return isRecord(value) ? getStringField(value, 'type') : undefined;
}

function isFileContentPartType(value: unknown): value is FileContentPartType {
  return typeof value === 'string' && FILE_CONTENT_PART_TYPES.has(value);
}

function getMimeType(record: UnknownRecord): string {
  return getStringField(record, 'mime_type') ?? 'unknown';
}
