import type {BaseNode} from './traceTreeNode/baseNode';

export function getVisibleParent(node: BaseNode): BaseNode | null {
  if (node.visibleParent !== undefined) {
    return node.visibleParent;
  }

  let start = node.parent;

  while (start) {
    if (
      start.directVisibleChildren.includes(node) &&
      (start.isRootNodeChild() || getVisibleParent(start) !== null)
    ) {
      node.visibleParent = start;
      return node.visibleParent;
    }

    start = start.parent;
  }

  node.visibleParent = null;
  return node.visibleParent;
}

/**
 * Return a lazily calculated depth of the node in the tree.
 * Root node has a value of -1 as it is abstract.
 */
export function getNodeDepth(node: BaseNode): number {
  if (node.depth !== undefined) {
    return node.depth;
  }

  const visibleParent = getVisibleParent(node);
  node.depth = visibleParent ? getNodeDepth(visibleParent) + 1 : 0;
  return node.depth;
}

export function isLastVisibleChild(node: BaseNode): boolean {
  const visibleParent = getVisibleParent(node);

  if (!visibleParent) {
    return node.isLastChild();
  }

  const visibleChildren = visibleParent.directVisibleChildren;
  return visibleChildren[visibleChildren.length - 1] === node;
}

export function getNodeConnectors(node: BaseNode): number[] {
  if (node.connectors !== undefined) {
    return node.connectors;
  }

  const connectors: number[] = [];
  let start = getVisibleParent(node);

  if (start?.isRootNodeChild() && !isLastVisibleChild(node)) {
    node.connectors = [-getNodeDepth(node)];
    return node.connectors;
  }

  if (!isLastVisibleChild(node)) {
    connectors.push(getNodeDepth(node));
  }

  while (start) {
    if (!start.value) {
      break;
    }

    const visibleParent = getVisibleParent(start);
    if (!visibleParent) {
      break;
    }

    if (isLastVisibleChild(start)) {
      start = visibleParent;
      continue;
    }

    connectors.push(
      visibleParent.isRootNodeChild() ? -getNodeDepth(start) : getNodeDepth(start)
    );
    start = visibleParent;
  }

  node.connectors = connectors;
  return connectors;
}
