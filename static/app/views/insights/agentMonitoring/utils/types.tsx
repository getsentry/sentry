import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

export type AITraceSpanNode = TraceTreeNode<
  TraceTree.Transaction | TraceTree.EAPSpan | TraceTree.Span
>;
