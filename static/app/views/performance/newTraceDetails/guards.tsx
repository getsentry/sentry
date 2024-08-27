import {
  MissingInstrumentationNode,
  ParentAutogroupNode,
  SiblingAutogroupNode,
  type TraceTree,
  type TraceTreeNode,
} from './traceModels/traceTree';

export function isMissingInstrumentationNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is MissingInstrumentationNode {
  return node instanceof MissingInstrumentationNode;
}

export function isSpanNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is TraceTreeNode<TraceTree.Span> {
  return (
    !!(node.value && !('transaction' in node.value) && 'span_id' in node.value) &&
    !isAutogroupedNode(node)
  );
}

export function isTransactionNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is TraceTreeNode<TraceTree.Transaction> {
  return !!(node.value && 'transaction' in node.value) && !isAutogroupedNode(node);
}

export function isParentAutogroupedNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is ParentAutogroupNode {
  return node instanceof ParentAutogroupNode;
}

export function isSiblingAutogroupedNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is SiblingAutogroupNode {
  return node instanceof SiblingAutogroupNode;
}

export function isAutogroupedNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is ParentAutogroupNode | SiblingAutogroupNode {
  return node instanceof ParentAutogroupNode || node instanceof SiblingAutogroupNode;
}

export function isTraceErrorNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is TraceTreeNode<TraceTree.TraceError> {
  return !!(node.value && 'level' in node.value);
}

export function isRootNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is TraceTreeNode<null> {
  return node.value === null;
}

export function isTraceNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is TraceTreeNode<TraceTree.Trace> {
  return !!(
    node.value &&
    ('orphan_errors' in node.value || 'transactions' in node.value)
  );
}

export function shouldAddMissingInstrumentationSpan(sdk: string | undefined): boolean {
  if (!sdk) return true;
  if (sdk.length < 'sentry.javascript.'.length) return true;

  switch (sdk.toLowerCase()) {
    case 'sentry.javascript.browser':
    case 'sentry.javascript.react':
    case 'sentry.javascript.gatsby':
    case 'sentry.javascript.ember':
    case 'sentry.javascript.vue':
    case 'sentry.javascript.angular':
    case 'sentry.javascript.angular-ivy':
    case 'sentry.javascript.nextjs':
    case 'sentry.javascript.electron':
    case 'sentry.javascript.remix':
    case 'sentry.javascript.svelte':
    case 'sentry.javascript.sveltekit':
    case 'sentry.javascript.react-native':
    case 'sentry.javascript.astro':
      return false;
    case undefined:
      return true;
    default:
      return true;
  }
}
