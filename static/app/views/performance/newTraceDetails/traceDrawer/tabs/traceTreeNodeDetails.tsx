import type {Organization} from 'sentry/types/organization';
import type {ReplayRecord} from 'sentry/views/replays/types';

import {
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from '../../traceGuards';
import type {TraceTree} from '../../traceModels/traceTree';
import type {TraceTreeNode} from '../../traceModels/traceTreeNode';
import type {VirtualizedViewManager} from '../../traceRenderers/virtualizedViewManager';
import {ErrorNodeDetails} from '../details/error';
import {MissingInstrumentationNodeDetails} from '../details/missingInstrumentation';
import {ParentAutogroupNodeDetails} from '../details/parentAutogroup';
import {SiblingAutogroupNodeDetails} from '../details/siblingAutogroup';
import {SpanNodeDetails} from '../details/span/index';
import {TransactionNodeDetails} from '../details/transaction/index';

export interface TraceTreeNodeDetailsProps<T> {
  manager: VirtualizedViewManager;
  node: T;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  onTabScrollToNode: (node: TraceTreeNode<any>) => void;
  organization: Organization;
  replayRecord: ReplayRecord | null;
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

  if (isParentAutogroupedNode(props.node)) {
    return <ParentAutogroupNodeDetails {...props} />;
  }

  if (isSiblingAutogroupedNode(props.node)) {
    return <SiblingAutogroupNodeDetails {...props} />;
  }

  if (isMissingInstrumentationNode(props.node)) {
    return <MissingInstrumentationNodeDetails {...props} />;
  }

  throw new Error('Unknown clicked node type');
}
