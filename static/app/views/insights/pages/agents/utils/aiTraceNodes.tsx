import type {Theme} from '@emotion/react';

import type {EventTransaction} from 'sentry/types/event';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  GenAiOperationType,
  getGenAiOperationTypeFromSpanName,
  getIsAiAgentSpan,
  getIsAiGenerationSpan,
  getIsExecuteToolSpan,
} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

// TODO(aknaus): Remove the special handling for tags once the endpoint returns the correct type
function getAttributeValue(
  attribute: TraceItemResponseAttribute
): string | number | boolean {
  if (!attribute.name.startsWith('tags[')) {
    return attribute.value;
  }
  if (attribute.type === 'int') {
    return Number(attribute.value);
  }
  if (attribute.type === 'float') {
    return Number(attribute.value);
  }
  if (attribute.type === 'bool') {
    /* @ts-expect-error - tags are always returned as strings */
    return attribute.value === 'true';
  }
  return attribute.value;
}

export function ensureAttributeObject(
  node: AITraceSpanNode,
  event?: EventTransaction,
  attributes?: TraceItemResponseAttribute[]
) {
  if (attributes) {
    return attributes.reduce<Record<string, string | number | boolean>>(
      (acc, attribute) => {
        // Some attribute keys include prefixes and metadata (e.g. "tags[ai.prompt_tokens.used,number]")
        // prettifyAttributeName normalizes those
        acc[prettifyAttributeName(attribute.name)] = getAttributeValue(attribute);
        return acc;
      },
      {}
    );
  }

  if (event) {
    return event.contexts.trace?.data;
  }

  return node.attributes;
}

/**
 * Returns the `gen_ai.operation.type` for a given trace node.
 * If the attribute is not present it will deduce it from the `span.name`
 *
 * **Note:** To keep the complexity manageable, this logic does not work for the edge case of transactions without `span.name` on the old data model.
 */
export function getGenAiOpType(node: BaseNode): string | undefined {
  const attributeObject = node.attributes;

  return (
    (attributeObject?.[SpanFields.GEN_AI_OPERATION_TYPE] as string | undefined) ??
    getGenAiOperationTypeFromSpanName(
      node.value && 'name' in node.value ? node.value.name : undefined
    )
  );
}

export function getTraceNodeAttribute(
  name: string,
  node: AITraceSpanNode,
  event?: EventTransaction,
  attributes?: TraceItemResponseAttribute[]
): string | number | boolean | undefined {
  const attributeObject = ensureAttributeObject(node, event, attributes);
  return attributeObject?.[name];
}

function createGetIsAiNode(predicate: (genAiOpType: string | undefined) => boolean) {
  return (node: BaseNode): node is AITraceSpanNode => {
    return predicate(getGenAiOpType(node));
  };
}

export const getIsAiNode = createGetIsAiNode(Boolean);
export const getIsAiAgentNode = createGetIsAiNode(getIsAiAgentSpan);
export const getIsAiGenerationNode = createGetIsAiNode(getIsAiGenerationSpan);
export const getIsExecuteToolNode = createGetIsAiNode(getIsExecuteToolSpan);

export function getStringAttr(node: AITraceSpanNode, field: string): string | undefined {
  const val = getTraceNodeAttribute(field, node);
  return typeof val === 'string' ? val : undefined;
}

/**
 * Agent name fallback resolution.
 *
 * The Vercel AI SDK sends `gen_ai.function_id` instead of the standard
 * `gen_ai.agent.name` attribute. The constants and helpers below provide
 * centralized fallback logic so agent identification works regardless of
 * which attribute the SDK sets.
 */

/**
 * Fields to check when resolving an agent name, in priority order.
 */
export const AGENT_NAME_FIELDS = [
  SpanFields.GEN_AI_AGENT_NAME,
  SpanFields.GEN_AI_FUNCTION_ID,
] as const;

/**
 * Resolves the agent name from a keyed record (span row, attributes map, etc.)
 * by trying each field in priority order.
 */
export function resolveAgentName(data: Record<string, unknown>): string | undefined {
  for (const field of AGENT_NAME_FIELDS) {
    const value = data[field];
    if (value && typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

export function getNumberAttr(node: AITraceSpanNode, field: string): number | undefined {
  const val = getTraceNodeAttribute(field, node);
  if (typeof val === 'number') {
    return val;
  }
  if (typeof val === 'string') {
    const num = Number(val);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

const MAX_TOOL_INPUT_PREVIEW_LENGTH = 96;
const MAX_TOOL_INPUT_VALUE_LENGTH = 48;
const MAX_TOOL_INPUT_PREVIEW_KEYS = 4;

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength - 3))}...`
    : value;
}

function previewToolArgumentValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return JSON.stringify(truncateText(value, MAX_TOOL_INPUT_VALUE_LENGTH));
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return truncateText(
    JSON.stringify(value).replace(/\s+/g, ' ').trim(),
    MAX_TOOL_INPUT_VALUE_LENGTH
  );
}

function formatToolInputPreview(input: unknown): string | undefined {
  if (input === null || input === undefined || input === '') {
    return undefined;
  }

  if (typeof input === 'string') {
    const formatted = input.replace(/\s+/g, ' ').trim();
    return formatted ? truncateText(formatted, MAX_TOOL_INPUT_PREVIEW_LENGTH) : undefined;
  }

  if (Array.isArray(input)) {
    return truncateText(
      JSON.stringify(input).replace(/\s+/g, ' ').trim(),
      MAX_TOOL_INPUT_PREVIEW_LENGTH
    );
  }

  if (typeof input === 'object') {
    const entries = Object.entries(input as Record<string, unknown>).slice(
      0,
      MAX_TOOL_INPUT_PREVIEW_KEYS
    );
    if (entries.length === 0) {
      return undefined;
    }
    return entries
      .map(([key, value]) => `${key}: ${previewToolArgumentValue(value)}`)
      .join(', ');
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return String(input);
  }

  return undefined;
}

/**
 * Builds a compact preview of a tool call's input arguments to show next to the
 * tool name. Objects are rendered as `key1: "value1", key2: "value2"` (up to
 * four keys); strings, arrays, and primitives are stringified and truncated.
 */
export function getToolInputPreview(node: AITraceSpanNode): string | undefined {
  const toolInput =
    getStringAttr(node, 'gen_ai.tool.call.arguments') ||
    getStringAttr(node, 'gen_ai.tool.input');
  if (!toolInput) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(toolInput);
  } catch {
    // Not valid JSON; fall back to previewing the raw string.
    parsed = toolInput;
  }

  return formatToolInputPreview(parsed);
}

export function hasError(node: AITraceSpanNode): boolean {
  if (node.errors.size > 0) {
    return true;
  }

  const spanStatus = getStringAttr(node, SpanFields.SPAN_STATUS);
  if (spanStatus) {
    // Preserve precedence: when span.status exists, legacy status should not override it.
    return spanStatus.includes('error');
  }

  return !!getStringAttr(node, 'status')?.includes('error');
}

export type ColorByOpType = Record<GenAiOperationType | 'default' | 'error', string>;

/**
 * Resolves a span node to a color using the given op-type palette, falling back
 * to the error color for errored spans and `default` for unknown op types.
 */
export function getSpanColor(
  node: AITraceSpanNode,
  colorByOpType: ColorByOpType
): string {
  if (hasError(node)) {
    return colorByOpType.error;
  }
  const opType = getGenAiOpType(node);
  return colorByOpType[opType as GenAiOperationType] ?? colorByOpType.default;
}

/**
 * Op-type color palette used by the AI span timeline and mirrored by the
 * conversation span detail so a selected span's color ties back to its row.
 */
export function getTimelineColorByOpType(theme: Theme): ColorByOpType {
  return {
    [GenAiOperationType.AGENT]: theme.tokens.content.promotion,
    [GenAiOperationType.AI_CLIENT]: theme.tokens.content.success,
    [GenAiOperationType.HANDOFF]: theme.tokens.content.warning,
    [GenAiOperationType.TOOL]: theme.tokens.content.accent,
    default: theme.tokens.content.secondary,
    error: theme.tokens.content.danger,
  };
}
