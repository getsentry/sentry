import type {Organization} from 'sentry/types/organization';
import {AutogroupNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/autogroup';
import {ErrorNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/error';
import {MissingInstrumentationNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/missingInstrumentation';
import {SpanNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/index';
import {TransactionNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/index';
import {UptimeNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/uptime/index';
import {UptimeTimingDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/uptime/timing';
import {
  isAutogroupedNode,
  isEAPErrorNode,
  isEAPSpanNode,
  isMissingInstrumentationNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
  isUptimeCheckNode,
  isUptimeCheckTimingNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import type {ReplayRecord} from 'sentry/views/replays/types';

export interface TraceTreeNodeDetailsProps<T> {
  manager: VirtualizedViewManager | null;
  node: T;
  onParentClick: (node: BaseNode) => void;
  onTabScrollToNode: (node: BaseNode) => void;
  organization: Organization;
  replay: ReplayRecord | null;
  traceId: string;
  hideNodeActions?: boolean;
  tree?: TraceTree;
}

export function TraceTreeNodeDetails(props: TraceTreeNodeDetailsProps<any>) {
  if (isTransactionNode(props.node)) {
    return <TransactionNodeDetails {...props} />;
  }

  if (isUptimeCheckNode(props.node)) {
    return <UptimeNodeDetails {...props} />;
  }

  if (isUptimeCheckTimingNode(props.node)) {
    return <UptimeTimingDetails {...props} />;
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
