import {getStringAttr} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

const TOOL_OUTPUT_ATTRIBUTES = ['gen_ai.tool.call.result', 'gen_ai.tool.output'];

/**
 * Tool-call spans don't report token usage, so their output size is approximated
 * from the tool result. The result lives on the `gen_ai.tool.call.result` /
 * `gen_ai.tool.output` attributes, which the conversation list endpoint returns
 * on each span. Returns the byte length of the output, or `0` when unavailable.
 */
export function getToolOutputBytes(node: AITraceSpanNode): number {
  return getToolOutputBytesFromAttributes(key => getStringAttr(node, key));
}

/**
 * Same as `getToolOutputBytes`, for callers that only have raw span attributes
 * (e.g. the trace drawer) rather than a trace node.
 */
export function getToolOutputBytesFromAttributes(
  getAttribute: (key: string) => string | number | boolean | undefined
): number {
  for (const key of TOOL_OUTPUT_ATTRIBUTES) {
    const output = getAttribute(key);
    if (output) {
      return new TextEncoder().encode(output.toString()).length;
    }
  }
  return 0;
}
