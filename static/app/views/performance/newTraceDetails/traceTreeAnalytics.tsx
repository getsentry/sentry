import type {TracingEventParameters} from 'sentry/utils/analytics/tracingEventMap';

import type {TraceTree} from './traceModels/traceTree';
import type {TraceTreeNode} from './traceModels/traceTreeNode';
import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isRootNode,
  isSpanNode,
  isTraceErrorNode,
  isTraceNode,
  isTransactionNode,
} from './traceGuards';

// Name of node for analytics purposes
export function traceNodeAnalyticsName(node: TraceTreeNode<TraceTree.NodeValue>): string {
  if (isAutogroupedNode(node)) {
    return isParentAutogroupedNode(node) ? 'parent autogroup' : 'sibling autogroup';
  }
  if (isSpanNode(node)) {
    return 'span';
  }
  if (isTransactionNode(node)) {
    return 'transaction';
  }
  if (isMissingInstrumentationNode(node)) {
    return 'missing instrumentation';
  }
  if (isRootNode(node)) {
    return 'root';
  }
  if (isTraceNode(node)) {
    return 'trace';
  }
  if (isTraceErrorNode(node)) {
    return 'error';
  }
  return 'unknown';
}

// Adds some extra properties to the node for analytics purposes
export function traceNodeAdjacentAnalyticsProperties(
  node: TraceTreeNode<TraceTree.NodeValue>
): Pick<
  TracingEventParameters['trace.trace_layout.span_row_click'],
  'next_op' | 'parent_op' | 'previous_op'
> {
  if (isMissingInstrumentationNode(node)) {
    return {
      previous_op: node.previous.value.op,
      next_op: node.next.value.op,
    };
  }

  return {};
}
