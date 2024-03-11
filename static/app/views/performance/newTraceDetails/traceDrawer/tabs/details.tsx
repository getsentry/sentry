import type {Location} from 'history';

import type {Organization} from 'sentry/types';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/virtualizedViewManager';

import {
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from '../../guards';
import type {TraceTree, TraceTreeNode} from '../../traceTree';
import {ErrorNodeDetails} from '../details/error';
import {MissingInstrumentationNodeDetails} from '../details/missingInstrumentation';
import {ParentAutogroupNodeDetails} from '../details/parentAutogroup';
import {SiblingAutogroupNodeDetails} from '../details/siblingAutogroup';
import {SpanNodeDetails} from '../details/span';
import {TransactionNodeDetails} from '../details/transaction';

export default function NodeDetail({
  node,
  organization,
  location,
  manager,
  scrollToNode,
}: {
  location: Location;
  manager: VirtualizedViewManager;
  node: TraceTreeNode<TraceTree.NodeValue>;
  organization: Organization;
  scrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
}) {
  if (isTransactionNode(node)) {
    return (
      <TransactionNodeDetails
        node={node}
        organization={organization}
        location={location}
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
        scrollToNode={scrollToNode}
      />
    );
  }

  if (isTraceErrorNode(node)) {
    return <ErrorNodeDetails node={node} organization={organization} />;
  }

  if (isParentAutogroupedNode(node)) {
    return <ParentAutogroupNodeDetails node={node} />;
  }

  if (isSiblingAutogroupedNode(node)) {
    return <SiblingAutogroupNodeDetails node={node} />;
  }

  if (isMissingInstrumentationNode(node)) {
    return <MissingInstrumentationNodeDetails node={node} />;
  }

  throw new Error('Unknown clicked node type');
}
