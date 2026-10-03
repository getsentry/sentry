import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {getAIToolOutput} from 'sentry/views/performance/traceDetails/traceDrawer/details/span/eapSections/aiOutput';

/**
 * Tool-call spans don't report token usage, so their output size is approximated
 * from the raw tool result, using the same attribute precedence as span details.
 * Returns the byte length of the output, or `0` when unavailable.
 */
export function getToolOutputBytes(node: AITraceSpanNode): number {
  const output = getAIToolOutput(node)?.toString() ?? '';
  return new TextEncoder().encode(output).length;
}
