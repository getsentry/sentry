import type {TracingEventParameters} from 'sentry/utils/analytics/tracingEventMap';

import type {BaseNode} from './traceModels/traceTreeNode/baseNode';
import {
  isAutogroupedNode,
  isEAPErrorNode,
  isEAPSpanNode,
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isRootNode,
  isSpanNode,
  isTraceErrorNode,
  isTraceNode,
  isTransactionNode,
} from './traceGuards';

// Name of node for analytics purposes
export function traceNodeAnalyticsName(node: BaseNode): string {
  if (isAutogroupedNode(node)) {
    return isParentAutogroupedNode(node) ? 'parent autogroup' : 'sibling autogroup';
  }
  if (isSpanNode(node)) {
    return 'span';
  }
  if (isEAPSpanNode(node)) {
    return 'eap span';
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
  if (isEAPErrorNode(node)) {
    return 'eap error';
  }
  return 'unknown';
}

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
