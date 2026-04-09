import type {EventTransaction} from 'sentry/types/event';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  getGenAiOperationTypeFromSpanOp,
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
    return attributes.reduce(
      (acc, attribute) => {
        // Some attribute keys include prefixes and metadata (e.g. "tags[ai.prompt_tokens.used,number]")
        // prettifyAttributeName normalizes those
        acc[prettifyAttributeName(attribute.name)] = getAttributeValue(attribute);
        return acc;
      },
      {} as Record<string, string | number | boolean>
    );
  }

  if (event) {
    return event.contexts.trace?.data;
  }

  return node.attributes;
}

/**
 * Returns the `gen_ai.operation.type` for a given trace node.
 * If the attribute is not present it will deduce it from the `span.op`
 *
 * **Note:** To keep the complexity manageable, this logic does not work for the edge case of transactions without `span.op` on the old data model.
 */
export function getGenAiOpType(node: BaseNode): string | undefined {
  const attributeObject = node.attributes;

  return (
    (attributeObject?.[SpanFields.GEN_AI_OPERATION_TYPE] as string | undefined) ??
    getGenAiOperationTypeFromSpanOp(node.op)
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

export const getIsAiNode = createGetIsAiNode(genAiOpType => Boolean(genAiOpType));
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

const MAX_TOOL_INPUT_PREVIEW_LENGTH = 80;

/**
 * Parses tool input JSON and returns the value of the first key.
 * Used to show a preview of the tool input next to the tool name.
 */
export function getFirstToolInputValue(node: AITraceSpanNode): string | undefined {
  const toolInput =
    getStringAttr(node, 'gen_ai.tool.call.arguments') ||
    getStringAttr(node, 'gen_ai.tool.input');
  if (!toolInput) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(toolInput);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const firstKey = Object.keys(parsed)[0];
      if (firstKey !== undefined) {
        const value = parsed[firstKey];
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        if (str.length > MAX_TOOL_INPUT_PREVIEW_LENGTH) {
          return str.slice(0, MAX_TOOL_INPUT_PREVIEW_LENGTH) + '\u2026';
        }
        return str;
      }
    }
  } catch {
    // Invalid JSON, return undefined
  }

  return undefined;
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
