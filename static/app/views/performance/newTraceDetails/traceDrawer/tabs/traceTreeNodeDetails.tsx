import type {Organization} from 'sentry/types';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/virtualizedViewManager';

import {
  isMissingInstrumentationNode,
  isNoDataNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from '../../guards';
import type {TraceTree, TraceTreeNode} from '../../traceTree';
import {ErrorNodeDetails} from '../details/error';
import {MissingInstrumentationNodeDetails} from '../details/missingInstrumentation';
import {NoDataDetails} from '../details/noData';
import {ParentAutogroupNodeDetails} from '../details/parentAutogroup';
import {SiblingAutogroupNodeDetails} from '../details/siblingAutogroup';
import {SpanNodeDetails} from '../details/span';
import {TransactionNodeDetails} from '../details/transaction';

export interface TraceTreeNodeDetailsProps<T> {
  manager: VirtualizedViewManager;
  node: T;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
  scrollToNode: (node: T) => void;
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

  if (isNoDataNode(props.node)) {
    return <NoDataDetails {...props} />;
  }

  throw new Error('Unknown clicked node type');
}
