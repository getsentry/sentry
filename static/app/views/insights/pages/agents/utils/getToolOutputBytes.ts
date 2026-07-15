import {getStringAttr} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

/**
 * Tool-call spans don't report token usage, so their output size is approximated
 * from the tool result. The result lives on the `gen_ai.tool.call.result` /
 * `gen_ai.tool.output` attributes, which the conversation list endpoint returns
 * on each span. Returns the byte length of the output, or `0` when unavailable.
 */
export function getToolOutputBytes(node: AITraceSpanNode): number {
  const output =
    getStringAttr(node, 'gen_ai.tool.call.result') ||
    getStringAttr(node, 'gen_ai.tool.output') ||
    '';
  return new TextEncoder().encode(output).length;
}
