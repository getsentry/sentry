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

export default function NodeDetail({
  node,
  organization,
  manager,
  scrollToNode,
  onParentClick,
}: {
  manager: VirtualizedViewManager;
  node: TraceTreeNode<TraceTree.NodeValue>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
  scrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
}) {
  if (isTransactionNode(node)) {
    return (
      <TransactionNodeDetails
        node={node}
        organization={organization}
        onParentClick={onParentClick}
        manager={manager}
        scrollToNode={scrollToNode}
      />
    );
  }

  if (isSpanNode(node)) {
    return (
      <SpanNodeDetails
        node={node}
        organization={organization}
        onParentClick={onParentClick}
        scrollToNode={scrollToNode}
      />
    );
  }

  if (isTraceErrorNode(node)) {
    return (
      <ErrorNodeDetails
        node={node}
        organization={organization}
        onParentClick={onParentClick}
        scrollToNode={scrollToNode}
      />
    );
  }

  if (isParentAutogroupedNode(node)) {
    return (
      <ParentAutogroupNodeDetails
        node={node}
        organization={organization}
        onParentClick={onParentClick}
        scrollToNode={scrollToNode}
      />
    );
  }

  if (isSiblingAutogroupedNode(node)) {
    return (
      <SiblingAutogroupNodeDetails
        node={node}
        organization={organization}
        onParentClick={onParentClick}
        scrollToNode={scrollToNode}
      />
    );
  }

  if (isMissingInstrumentationNode(node)) {
    return (
      <MissingInstrumentationNodeDetails
        node={node}
        onParentClick={onParentClick}
        scrollToNode={scrollToNode}
      />
    );
  }

  if (isNoDataNode(node)) {
    return (
      <NoDataDetails
        node={node}
        onParentClick={onParentClick}
        organization={organization}
        scrollToNode={scrollToNode}
      />
    );
  }

  throw new Error('Unknown clicked node type');
}
