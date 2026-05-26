import {tryParsePythonDict} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentDetection';
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

type UnknownRecord = Record<string, unknown>;

type PartBuckets = {
  hasRenderableTextPart: boolean;
  objectParts: unknown[];
  textParts: string[];
  toolCalls: unknown[];
  toolResponses: UnknownRecord[];
};

// Keep this parser mirrored with src/sentry/utils/ai_message_normalizer.py.
// AI SDKs emit inconsistent shapes and their specs keep changing, so update both
// parsers together whenever adding or changing a supported format.

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
  const {fixedInvalidJson, messages: rawMessages} = rawMessagesFromAttribute(
    raw,
    defaultRole
  );
  const messages = normalizeRawMessages(rawMessages, defaultRole);

  return {
    fixedInvalidJson,
    messages: messages.length > 0 ? messages : null,
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
  const {fixedInvalidJson, messages: rawMessages} = rawMessagesFromAttribute(
    raw,
    defaultRole
  );

  if (rawMessages.length === 0) {
    return emptyOutput(fixedInvalidJson);
  }

  const selected = selectAssistantMessages(rawMessages);
  return outputFromMessages(selected, fixedInvalidJson);
}

function emptyOutput(fixedInvalidJson: boolean): AIOutputResult {
  return {
    fixedInvalidJson,
    responseText: null,
    responseObject: null,
    toolCalls: null,
  };
}

function normalizeRawMessages(
  rawMessages: RawMessage[],
  defaultRole: string
): AIMessage[] {
  const normalized: AIMessage[] = [];
  for (const msg of rawMessages) {
    const role = msg.role ?? defaultRole;
    const content = resolveMessageContent(msg, role);
    if (content === undefined || content === null || content === '') {
      continue;
    }
    normalized.push({role, content});
  }
  return normalized;
}

function outputFromMessages(
  messages: RawMessage[],
  fixedInvalidJson: boolean
): AIOutputResult {
  const textParts: string[] = [];
  const toolCallParts: unknown[] = [];
  const objectParts: unknown[] = [];
  for (const msg of messages) {
    appendOutputFromMessage(msg, {textParts, toolCallParts, objectParts});
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

function rawMessagesFromAttribute(
  raw: string,
  defaultRole: string
): {fixedInvalidJson: boolean; messages: RawMessage[]} {
  const {fixedInvalidJson, parsed} = parseAttribute(raw);
  if (parsed === undefined) {
    return {fixedInvalidJson, messages: []};
  }

  return {
    fixedInvalidJson,
    messages: rawMessagesFromValue(parsed, defaultRole),
  };
}

function parseAttribute(raw: string): {fixedInvalidJson: boolean; parsed: unknown} {
  if (!looksLikeJson(raw)) {
    return {fixedInvalidJson: false, parsed: raw};
  }
  const {parsed, fixedInvalidJson}: {fixedInvalidJson: boolean; parsed: unknown} =
    parseJsonWithFix(raw);
  if (parsed !== null) {
    return {fixedInvalidJson, parsed};
  }

  const pythonParsed = tryParsePythonDict(raw);
  if (pythonParsed !== null) {
    return {fixedInvalidJson: false, parsed: pythonParsed};
  }

  return {fixedInvalidJson, parsed: undefined};
}

/**
 * Maps an already-parsed value onto a list of raw messages.
 */
function rawMessagesFromValue(value: unknown, defaultRole: string): RawMessage[] {
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
    const innerParsed = parseJsonString(inner);
    if (innerParsed === undefined) {
      if (inner.trim()) {
        result.push({role: defaultRole, content: inner});
      }
      return result;
    }
    result.push(...rawMessagesFromValue(innerParsed, defaultRole));
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
  if (item.completion !== undefined) {
    return {
      role: role ?? defaultRole,
      roleExplicit: role !== undefined,
      content: item.completion,
    };
  }
  return null;
}

function resolveMessageContent(msg: RawMessage, role: string): unknown {
  if (msg.parts) {
    return collapseParts(msg.parts);
  }
  const parsed = parseJsonContentPreservingPrimitives(msg.content);
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
  const buckets = bucketParts(parts);

  if (buckets.hasRenderableTextPart) {
    return buckets.textParts.join('\n');
  }
  if (buckets.objectParts.length > 0) {
    return buckets.objectParts.length === 1
      ? buckets.objectParts[0]
      : buckets.objectParts;
  }
  if (buckets.toolCalls.length > 0) {
    return buckets.toolCalls;
  }
  if (buckets.toolResponses.length > 0) {
    return buckets.toolResponses.map(response => response.result).join('\n');
  }

  return undefined;
}

function bucketParts(parts: unknown[]): PartBuckets {
  const buckets: PartBuckets = {
    hasRenderableTextPart: false,
    textParts: [],
    objectParts: [],
    toolCalls: [],
    toolResponses: [],
  };
  for (const part of parts) {
    if (!isRecord(part)) {
      continue;
    }

    const partType = getPartType(part);
    if (isFileContentPartType(partType)) {
      buckets.hasRenderableTextPart = true;
      buckets.textParts.push(redactedFileContent(part));
      continue;
    }
    if (partType === 'text') {
      buckets.hasRenderableTextPart = true;
      const text = getTextPartContent(part, {trim: true});
      if (text) {
        buckets.textParts.push(text);
      }
      continue;
    }
    if (!partType) {
      const text = getTextPartContent(part, {trim: true});
      if (text) {
        buckets.textParts.push(text);
      }
      continue;
    }
    if (partType === 'object') {
      buckets.objectParts.push(part);
      continue;
    }
    if (partType === 'tool_call') {
      buckets.toolCalls.push(part);
      continue;
    }
    if (partType === 'tool_call_response') {
      buckets.toolResponses.push(part);
    }
  }

  return buckets;
}

function selectAssistantMessages(rawMessages: RawMessage[]): RawMessage[] {
  const hasRole = rawMessages.some(m => m.roleExplicit === true);
  if (hasRole) {
    return rawMessages.filter(m => m.role === 'assistant');
  }
  return [rawMessages[rawMessages.length - 1]!];
}

function appendOutputFromMessage(
  msg: RawMessage,
  buckets: {objectParts: unknown[]; textParts: string[]; toolCallParts: unknown[]}
): void {
  const {textParts, objectParts} = buckets;

  if (msg.parts) {
    appendOutputFromParts(msg.parts, buckets);
    return;
  }

  const content = parseJsonContentPreservingPrimitives(msg.content);
  if (content === undefined || content === null) {
    return;
  }
  if (typeof content === 'string' && content) {
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

function appendOutputFromParts(
  parts: unknown[],
  buckets: {objectParts: unknown[]; textParts: string[]; toolCallParts: unknown[]}
): void {
  const {textParts, toolCallParts, objectParts} = buckets;
  for (const part of parts) {
    const partType = getPartType(part);
    if (partType === 'text' && isRecord(part)) {
      const text = getStringField(part, 'content') ?? getStringField(part, 'text');
      if (text) {
        textParts.push(text);
      }
      continue;
    }
    if (partType === 'tool_call') {
      toolCallParts.push(part);
      continue;
    }
    if (partType === 'object') {
      objectParts.push(part);
      continue;
    }
    if (isFileContentPartType(partType) && isRecord(part)) {
      textParts.push(redactedFileContent(part));
    }
  }
}

const FILE_CONTENT_PARTS = ['blob', 'uri', 'file'] as const;
const FILE_CONTENT_PART_TYPES = new Set<string>(FILE_CONTENT_PARTS);
type FileContentPartType = (typeof FILE_CONTENT_PARTS)[number];
function parseJsonContentPreservingPrimitives(value: unknown): unknown {
  const parsed = tryParseJsonRecursive(value);
  if (
    typeof value === 'string' &&
    (parsed === null || typeof parsed === 'number' || typeof parsed === 'boolean')
  ) {
    return value;
  }
  return parsed;
}

function parseJsonString(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function looksLikeJson(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  const first = trimmed[0];
  return first === '[' || first === '{' || first === '"';
}

function extractTextFromContentParts(parts: unknown[]): string {
  return bucketParts(parts).textParts.join('\n');
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

function getTextPartContent(
  record: UnknownRecord,
  options: {trim?: boolean} = {}
): string | undefined {
  const text = getStringField(record, 'text') ?? getStringField(record, 'content');
  return options.trim ? text?.trim() : text;
}

function redactedFileContent(record: UnknownRecord): string {
  return `\n\n[redacted content of type "${getMimeType(record)}"]\n\n`;
}
