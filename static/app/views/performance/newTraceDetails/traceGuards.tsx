import type {TraceSplitResults} from 'sentry/utils/performance/quickTrace/types';

import {MissingInstrumentationNode} from './traceModels/missingInstrumentationNode';
import {ParentAutogroupNode} from './traceModels/parentAutogroupNode';
import {SiblingAutogroupNode} from './traceModels/siblingAutogroupNode';
import {CollapsedNode} from './traceModels/traceCollapsedNode';
import type {TraceTree} from './traceModels/traceTree';
import type {TraceTreeNode} from './traceModels/traceTreeNode';

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
    !isMissingInstrumentationNode(node) &&
    !isAutogroupedNode(node)
  );
}

export function isEAPSpanNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is TraceTreeNode<TraceTree.EAPSpan> {
  return !!(node.value && 'is_transaction' in node.value);
}

export function isTransactionNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is TraceTreeNode<TraceTree.Transaction> {
  return (
    !!(node.value && 'transaction' in node.value) &&
    !isAutogroupedNode(node) &&
    !isEAPSpanNode(node)
  );
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

export function isCollapsedNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is CollapsedNode {
  return node instanceof CollapsedNode;
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
): node is TraceTreeNode<TraceSplitResults<TraceTree.Transaction>> {
  return !!(
    node.value &&
    ('orphan_errors' in node.value || 'transactions' in node.value)
  );
}

export function isEAPTraceNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is TraceTreeNode<TraceTree.EAPTrace> {
  return !!node.value && Array.isArray(node.value) && !isTraceNode(node);
}

export function shouldAddMissingInstrumentationSpan(sdk: string | undefined): boolean {
  if (!sdk) {
    return true;
  }
  if (sdk.length < 'sentry.javascript.'.length) {
    return true;
  }

  switch (sdk.toLowerCase()) {
    case 'sentry.javascript.browser':
    case 'sentry.javascript.react':
    case 'sentry.javascript.gatsby':
    case 'sentry.javascript.ember':
    case 'sentry.javascript.vue':
    case 'sentry.javascript.angular':
    case 'sentry.javascript.angular-ivy':
    case 'sentry.javascript.nextjs':
    case 'sentry.javascript.nuxt':
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

export function isJavascriptSDKEvent(value: TraceTree.NodeValue): boolean {
  return (
    !!value &&
    'sdk_name' in value &&
    /javascript|angular|astro|backbone|ember|gatsby|nextjs|react|remix|svelte|vue/.test(
      value.sdk_name
    )
  );
}

export function isPageloadTransactionNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): boolean {
  return isTransactionNode(node) && node.value['transaction.op'] === 'pageload';
}

export function isServerRequestHandlerTransactionNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): boolean {
  return isTransactionNode(node) && node.value['transaction.op'] === 'http.server';
}

export function isBrowserRequestSpan(value: TraceTree.Span): boolean {
  return (
    // Adjust for SDK changes in https://github.com/getsentry/sentry-javascript/pull/13527
    value.op === 'browser.request' ||
    (value.op === 'browser' && value.description === 'request')
  );
}

export function getPageloadTransactionChildCount(
  node: TraceTreeNode<TraceTree.NodeValue>
): number {
  if (!isTransactionNode(node)) {
    return 0;
  }
  let count = 0;
  for (const txn of node.value.children) {
    if (txn && txn['transaction.op'] === 'pageload') {
      count++;
    }
  }
  return count;
}

export function isTracePerformanceIssue(
  issue: TraceTree.TraceError | TraceTree.TracePerformanceIssue
): issue is TraceTree.TracePerformanceIssue {
  return 'suspect_spans' in issue;
}
