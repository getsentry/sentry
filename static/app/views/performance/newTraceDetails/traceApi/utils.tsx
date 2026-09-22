import type {TraceItemDetailsResponse} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

export function isBrowserRequestNode(node: BaseNode): boolean {
  return (
    // Adjust for SDK changes in https://github.com/getsentry/sentry-javascript/pull/13527
    node.op === 'browser.request' ||
    (node.op === 'browser' && node.description === 'request')
  );
}

export function isEmptyTrace(trace: TraceTree.EAPTrace): boolean {
  return trace.length === 0;
}

export const isTraceItemDetailsResponse = (
  data: TraceRootEventQueryResults['data']
): data is TraceItemDetailsResponse => {
  return data !== undefined && 'attributes' in data;
};
