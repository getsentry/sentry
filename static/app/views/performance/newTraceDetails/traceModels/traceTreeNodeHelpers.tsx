import {
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
} from '../traceGuards';

import {MissingInstrumentationNode} from './missingInstrumentationNode';
import {ParentAutogroupNode} from './parentAutogroupNode';
import {SiblingAutogroupNode} from './siblingAutogroupNode';
import {TraceTreeNode} from './traceTreeNode';

export function cloneTraceTreeNode(
  node:
    | TraceTreeNode<any>
    | ParentAutogroupNode
    | SiblingAutogroupNode
    | MissingInstrumentationNode
): TraceTreeNode<any> {
  let cloned:
    | TraceTreeNode<any>
    | ParentAutogroupNode
    | SiblingAutogroupNode
    | MissingInstrumentationNode;

  if (isParentAutogroupedNode(node)) {
    cloned = new ParentAutogroupNode(
      node.parent,
      node.value,
      node.metadata,
      node.head,
      node.tail
    );
    (cloned as ParentAutogroupNode).groupCount = node.groupCount;
  } else if (isSiblingAutogroupedNode(node)) {
    cloned = new SiblingAutogroupNode(node.parent, node.value, node.metadata);
    (cloned as SiblingAutogroupNode).groupCount = node.groupCount;
  } else if (isMissingInstrumentationNode(node)) {
    cloned = new MissingInstrumentationNode(
      node.parent!,
      node.value,
      node.metadata,
      node.previous,
      node.next
    );
  } else {
    cloned = new TraceTreeNode(node.parent, node.value, node.metadata);
  }

  if (!cloneTraceTreeNode) {
    throw new Error('Clone is not implemented');
  }

  cloned.expanded = node.expanded;
  cloned.zoomedIn = node.zoomedIn;
  cloned.canFetch = node.canFetch;
  cloned.fetchStatus = node.fetchStatus;
  cloned.space = node.space;
  cloned.metadata = node.metadata;

  if (isParentAutogroupedNode(cloned)) {
    cloned.head = cloneTraceTreeNode(cloned.head);
    cloned.tail = cloneTraceTreeNode(cloned.tail);
    cloned.head.parent = cloned;

    // If the node is not expanded, the parent of the tail points to the
    // autogrouped cloned. If the node is expanded, the parent of the children
    // of the tail points to the autogrouped cloned.
    if (!cloned.expanded) {
      for (const c of cloned.tail.children) {
        c.parent = cloned;
      }
    } else {
      for (const c of cloned.children) {
        c.parent = cloned.tail;
      }
    }

    cloned.head.parent = cloned;
    cloned.tail.parent = cloned;
  } else if (isSiblingAutogroupedNode(cloned)) {
    for (const child of node.children) {
      const childClone = cloneTraceTreeNode(child);
      cloned.children.push(childClone);
      childClone.parent = cloned;
    }
  } else {
    for (const child of node.children) {
      const childClone = cloneTraceTreeNode(child);
      cloned.children.push(childClone);
      childClone.parent = cloned;
    }
  }

  node.cloneReference = cloned;
  return cloned;
}
