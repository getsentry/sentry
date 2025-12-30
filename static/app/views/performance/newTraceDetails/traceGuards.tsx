import type {TraceTree} from './traceModels/traceTree';
import type {BaseNode} from './traceModels/traceTreeNode/baseNode';
import type {CollapsedNode} from './traceModels/traceTreeNode/collapsedNode';
import type {EapSpanNode} from './traceModels/traceTreeNode/eapSpanNode';
import type {NoInstrumentationNode} from './traceModels/traceTreeNode/noInstrumentationNode';
import type {ParentAutogroupNode} from './traceModels/traceTreeNode/parentAutogroupNode';
import type {SiblingAutogroupNode} from './traceModels/traceTreeNode/siblingAutogroupNode';
import type {SpanNode} from './traceModels/traceTreeNode/spanNode';
import type {TransactionNode} from './traceModels/traceTreeNode/transactionNode';

export function isMissingInstrumentationNode(
  node: BaseNode
): node is NoInstrumentationNode {
  return !!(
    node.value &&
    'type' in node.value &&
    node.value.type === 'missing_instrumentation'
  );
}

export function isSpanNode(node: BaseNode): node is SpanNode {
  return !!(node.value && !('transaction' in node.value) && 'span_id' in node.value);
}

export function isEAPSpan(value: TraceTree.NodeValue): value is TraceTree.EAPSpan {
  return !!(value && 'is_transaction' in value);
}

export function isEAPSpanNode(node: BaseNode): node is EapSpanNode {
  return isEAPSpan(node.value);
}

export function isTransactionNode(node: BaseNode): node is TransactionNode {
  return !!(node.value && 'transaction.op' in node.value);
}

export function isUptimeCheck(
  value: TraceTree.NodeValue
): value is TraceTree.UptimeCheck {
  return !!(value && 'event_type' in value && value.event_type === 'uptime_check');
}

export function isEAPError(value: TraceTree.NodeValue): value is TraceTree.EAPError {
  return !!(
    value &&
    'event_type' in value &&
    value.event_type === 'error' &&
    'description' in value // a bit gross, but we won't need this soon as we remove the legacy error type
  );
}

export function isParentAutogroupedNode(node: BaseNode): node is ParentAutogroupNode {
  return !!(
    node.value &&
    'autogrouped_by' in node.value &&
    node.value.type === 'children_autogroup'
  );
}

export function isSiblingAutogroupedNode(node: BaseNode): node is SiblingAutogroupNode {
  return !!(
    node.value &&
    'autogrouped_by' in node.value &&
    node.value.type === 'sibling_autogroup'
  );
}

export function isCollapsedNode(node: BaseNode): node is CollapsedNode {
  return !!(node.value && 'type' in node.value && node.value.type === 'collapsed');
}

export function isTraceError(value: TraceTree.NodeValue): value is TraceTree.TraceError {
  return !!(value && 'level' in value && 'message' in value);
}
