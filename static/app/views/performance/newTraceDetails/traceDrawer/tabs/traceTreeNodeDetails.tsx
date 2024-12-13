import type {Organization} from 'sentry/types/organization';
import type {ReplayRecord} from 'sentry/views/replays/types';

import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from '../../traceGuards';
import type {TraceTree} from '../../traceModels/traceTree';
import type {TraceTreeNode} from '../../traceModels/traceTreeNode';
import type {VirtualizedViewManager} from '../../traceRenderers/virtualizedViewManager';
import {AutogroupNodeDetails} from '../details/autogroup';
import {ErrorNodeDetails} from '../details/error';
import {MissingInstrumentationNodeDetails} from '../details/missingInstrumentation';
import {SpanNodeDetails} from '../details/span/index';
import {TransactionNodeDetails} from '../details/transaction/index';

export interface TraceTreeNodeDetailsProps<T> {
  manager: VirtualizedViewManager;
  node: T;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  onTabScrollToNode: (node: TraceTreeNode<any>) => void;
  organization: Organization;
  replay: ReplayRecord | null;
}

export function TraceTreeNodeDetails(props: TraceTreeNodeDetailsProps<any>) {
  if (isTransactionNode(props.node)) {
    return <TransactionNodeDetails {...props} />;
  }

  if (isSpanNode(props.node)) {
    return <SpanNodeDetails {...props} />;
  }

  if (isTraceErrorNode(props.node)) {
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
