import type {Measurement} from 'sentry/types/event';

import type {TraceSplitResults} from './traceApi/types';
import type {TraceTree} from './traceModels/traceTree';
import type {BaseNode} from './traceModels/traceTreeNode/baseNode';
import type {CollapsedNode} from './traceModels/traceTreeNode/collapsedNode';
import type {EapSpanNode} from './traceModels/traceTreeNode/eapSpanNode';
import type {ErrorNode} from './traceModels/traceTreeNode/errorNode';
import type {NoInstrumentationNode} from './traceModels/traceTreeNode/noInstrumentationNode';
import type {ParentAutogroupNode} from './traceModels/traceTreeNode/parentAutogroupNode';
import type {RootNode} from './traceModels/traceTreeNode/rootNode';
import type {SiblingAutogroupNode} from './traceModels/traceTreeNode/siblingAutogroupNode';
import type {SpanNode} from './traceModels/traceTreeNode/spanNode';
import type {TransactionNode} from './traceModels/traceTreeNode/transactionNode';
import type {UptimeCheckNode} from './traceModels/traceTreeNode/uptimeCheckNode';
import type {UptimeCheckTimingNode} from './traceModels/traceTreeNode/uptimeCheckTimingNode';

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
  return (
    !!(node.value && !('transaction' in node.value) && 'span_id' in node.value) &&
    !isMissingInstrumentationNode(node) &&
    !isAutogroupedNode(node)
  );
}

export function isEAPSpan(value: TraceTree.NodeValue): value is TraceTree.EAPSpan {
  return !!(value && 'is_transaction' in value);
}

export function isEAPTransaction(value: TraceTree.NodeValue): value is TraceTree.EAPSpan {
  return isEAPSpan(value) && value.is_transaction;
}

export function isEAPTransactionNode(node: BaseNode): node is EapSpanNode {
  return isEAPTransaction(node.value);
}

export function isEAPSpanNode(node: BaseNode): node is EapSpanNode {
  return isEAPSpan(node.value);
}

export function isUptimeCheckNode(node: BaseNode): node is UptimeCheckNode {
  return isUptimeCheck(node.value);
}

export function isUptimeCheckTimingNode(node: BaseNode): node is UptimeCheckTimingNode {
  return !!(
    node.value &&
    'event_type' in node.value &&
    node.value.event_type === 'uptime_check_timing'
  );
}

export function isNonTransactionEAPSpanNode(node: BaseNode): node is EapSpanNode {
  return isEAPSpanNode(node) && !isEAPTransactionNode(node);
}

export function isTransactionNode(node: BaseNode): node is TransactionNode {
  return (
    !!(node.value && 'transaction' in node.value) &&
    !isAutogroupedNode(node) &&
    !isEAPSpanNode(node) &&
    !isUptimeCheckNode(node) &&
    !isUptimeCheckTimingNode(node) &&
    !isEAPErrorNode(node)
  );
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

export function isEAPErrorNode(node: BaseNode): node is BaseNode<TraceTree.EAPError> {
  return isEAPError(node.value);
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

export function isAutogroupedNode(
  node: BaseNode
): node is ParentAutogroupNode | SiblingAutogroupNode {
  return isParentAutogroupedNode(node) || isSiblingAutogroupedNode(node);
}

export function isCollapsedNode(node: BaseNode): node is CollapsedNode {
  return !!(node.value && 'type' in node.value && node.value.type === 'collapsed');
}

export function isTraceError(value: TraceTree.NodeValue): value is TraceTree.TraceError {
  return !!(value && 'level' in value && 'message' in value);
}

export function isTraceErrorNode(node: BaseNode): node is BaseNode<TraceTree.TraceError> {
  return isTraceError(node.value);
}

// TODO Abdullah Khan: Won't be needed once we fully migrate to the new BaseNode subclass
export function isErrorNode(node: BaseNode): node is ErrorNode {
  return isTraceErrorNode(node) || isEAPErrorNode(node);
}

export function isRootNode(node: BaseNode): node is RootNode {
  return node.value === null;
}

export function isTraceNode(
  node: BaseNode
): node is BaseNode<TraceSplitResults<TraceTree.Transaction>> {
  return !!(node.value && 'orphan_errors' in node.value && 'transactions' in node.value);
}

export function isEAPTraceNode(node: BaseNode): node is BaseNode<TraceTree.EAPTrace> {
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

export function isTransactionNodeEquivalent(
  node: BaseNode
): node is TransactionNode | EapSpanNode {
  return isTransactionNode(node) || isEAPTransaction(node.value);
}

export function isBrowserRequestNode(node: BaseNode): boolean {
  return (
    // Adjust for SDK changes in https://github.com/getsentry/sentry-javascript/pull/13527
    node.op === 'browser.request' ||
    (node.op === 'browser' && node.description === 'request')
  );
}

export function isTraceOccurence(
  issue: TraceTree.TraceIssue
): issue is TraceTree.TraceOccurrence {
  return 'issue_id' in issue && issue.event_type !== 'error';
}

export function isEAPTraceOccurrence(
  issue: TraceTree.TraceIssue
): issue is TraceTree.EAPOccurrence {
  return (
    isTraceOccurence(issue) && 'event_type' in issue && issue.event_type === 'occurrence'
  );
}

export function isEAPMeasurementValue(
  value: number | Measurement | undefined
): value is number {
  return value !== undefined && typeof value === 'number';
}

export function isEAPMeasurements(
  value: Record<string, Measurement> | Record<string, number> | undefined
): value is Record<string, number> {
  if (value === undefined) {
    return false;
  }

  return Object.values(value).every(isEAPMeasurementValue);
}

export function isStandaloneSpanMeasurementNode(node: BaseNode): boolean {
  if (node.value && 'op' in node.value && node.value.op) {
    if (
      node.value.op.startsWith('ui.webvital.') ||
      node.value.op.startsWith('ui.interaction.')
    ) {
      return true;
    }
  }

  return false;
}

export function isRootEvent(value: TraceTree.NodeValue): boolean {
  // Root events has no parent_span_id
  return !!value && 'parent_span_id' in value && value.parent_span_id === null;
}

export function isTraceSplitResult(
  result: TraceTree.Trace
): result is TraceSplitResults<TraceTree.Transaction> {
  return 'transactions' in result && 'orphan_errors' in result;
}
