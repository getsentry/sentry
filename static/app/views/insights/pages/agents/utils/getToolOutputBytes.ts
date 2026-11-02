import {getTraceNodeAttribute} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

const TOOL_OUTPUT_ATTRIBUTES = ['gen_ai.tool.call.result', 'gen_ai.tool.output'];

/**
 * Returns the reported tool output size in bytes, falling back to the UTF-8 byte
 * length of the tool result for older spans. Returns `0` when unavailable.
 */
export function getToolOutputBytes(node: AITraceSpanNode): number {
  return getToolOutputBytesFromAttributes(key => getTraceNodeAttribute(key, node));
}

/**
 * Same as `getToolOutputBytes`, for callers that only have raw span attributes
 * (e.g. the trace drawer) rather than a trace node.
 */
export function getToolOutputBytesFromAttributes(
  getAttribute: (key: string) => string | number | boolean | null | undefined
): number {
  const reportedSize = getReportedToolOutputBytes(
    getAttribute('gen_ai.tool.call.result.size')
  );
  if (reportedSize !== undefined) {
    return reportedSize;
  }

  for (const key of TOOL_OUTPUT_ATTRIBUTES) {
    const output = getAttribute(key);
    if (output) {
      return new TextEncoder().encode(output.toString()).length;
    }
  }
  return 0;
}

/**
 * Parses a reported `gen_ai.tool.call.result.size`. APIs return `null` for spans
 * without the attribute, which must fall back to measuring the result instead.
 */
export function getReportedToolOutputBytes(value: unknown): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) {
    return undefined;
  }
  const bytes = Number(value);
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : undefined;
}
