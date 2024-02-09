import {
  ParentAutogroupNode,
  type SiblingAutogroupNode,
  type TraceTree,
  type TraceTreeNode,
} from './traceTree';

export function isMissingInstrumentationNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is TraceTreeNode<TraceTree.MissingInstrumentationSpan> {
  return !!(
    node.value &&
    'type' in node.value &&
    node.value.type === 'missing_instrumentation'
  );
}

export function isSpanNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is TraceTreeNode<TraceTree.Span> {
  return !!(node.value && ('description' in node.value || 'span_id' in node.value));
}

export function isTransactionNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is TraceTreeNode<TraceTree.Transaction> {
  return !!(node.value && 'transaction' in node.value);
}

export function isParentAutogroupedNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is ParentAutogroupNode {
  return node instanceof ParentAutogroupNode;
}

export function isAutogroupedNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is ParentAutogroupNode | SiblingAutogroupNode {
  return !!(node.value && 'autogrouped_by' in node.value);
}

export function isTraceErrorNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is TraceTreeNode<TraceTree.TraceError> {
  return !!(node.value && 'level' in node.value);
}
