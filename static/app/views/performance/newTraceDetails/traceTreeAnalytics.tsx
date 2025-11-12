import type {TracingEventParameters} from 'sentry/utils/analytics/tracingEventMap';

import type {BaseNode} from './traceModels/traceTreeNode/baseNode';
import {isMissingInstrumentationNode} from './traceGuards';

// Adds some extra properties to the node for analytics purposes
export function traceNodeAdjacentAnalyticsProperties(
  node: BaseNode
): Pick<
  TracingEventParameters['trace.trace_layout.span_row_click'],
  'next_op' | 'parent_op' | 'previous_op'
> {
  if (isMissingInstrumentationNode(node)) {
    return {
      previous_op: node.previous.op,
      next_op: node.next.op,
    };
  }

  return {};
}
