import type {Organization} from 'sentry/types/organization';
import {AutogroupNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/autogroup';
import {ErrorNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/error';
import {MissingInstrumentationNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/missingInstrumentation';
import {SpanNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/index';
import {TransactionNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/index';
import {
  isAutogroupedNode,
  isEAPErrorNode,
  isEAPSpanNode,
  isMissingInstrumentationNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import type {ReplayRecord} from 'sentry/views/replays/types';

export interface TraceTreeNodeDetailsProps<T> {
  manager: VirtualizedViewManager | null;
  node: T;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  onTabScrollToNode: (node: TraceTreeNode<any>) => void;
  organization: Organization;
  replay: ReplayRecord | null;
  traceId: string;
  hideNodeActions?: boolean;
}

export function TraceTreeNodeDetails(props: TraceTreeNodeDetailsProps<any>) {
  if (isTransactionNode(props.node)) {
    return <TransactionNodeDetails {...props} />;
  }

  if (isSpanNode(props.node) || isEAPSpanNode(props.node)) {
    return <SpanNodeDetails {...props} />;
  }

  if (isTraceErrorNode(props.node) || isEAPErrorNode(props.node)) {
    return <ErrorNodeDetails {...props} />;
  }

  if (isAutogroupedNode(props.node)) {
    return <AutogroupNodeDetails {...props} />;
  }

  if (isMissingInstrumentationNode(props.node)) {
    return <MissingInstrumentationNodeDetails {...props} />;
  }

  throw new Error('Unknown clicked node type');
}
