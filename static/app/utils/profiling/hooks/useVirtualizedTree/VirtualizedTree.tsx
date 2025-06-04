import type {TreeLike} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';

import {VirtualizedTreeNode} from './VirtualizedTreeNode';

export class VirtualizedTree<T extends TreeLike> {
  roots: Array<VirtualizedTreeNode<T>> = [];
  flattened: Array<VirtualizedTreeNode<T>> = [];

  constructor(
    roots: Array<VirtualizedTreeNode<T>>,
    flattenedList?: Array<VirtualizedTreeNode<T>>
  ) {
    this.roots = roots;
    this.flattened = flattenedList || VirtualizedTree.toExpandedList(this.roots);
  }

  // Rebuilds the tree
  static fromRoots<T extends TreeLike>(
    items: T[],
    expanded?: boolean,
    skipFn: (n: VirtualizedTreeNode<T>) => boolean = () => false,
    // If we are selecting a sub-root of the tree and the user
    // has previously expended some of the children, we use this
    // to carry-them over and preserver their state.
    expandedNodes?: Set<T>
  ): VirtualizedTree<T> {
    const roots: Array<VirtualizedTreeNode<T>> = [];

    function toTreeNode(
      node: T,
      parent: VirtualizedTreeNode<T> | null,
      collection: Array<VirtualizedTreeNode<T>> | null,
      depth: number
    ) {
      const shouldUseExpandedSet = expandedNodes && expandedNodes.size > 0;

      const treeNode = new VirtualizedTreeNode<T>(
        node,
        parent,
        depth,
        shouldUseExpandedSet ? expandedNodes.has(node) : expanded
      );

      // We cannot skip root nodes, so we check that the parent is not null.
      // If the node should be skipped, then we don't add it to the tree and descend
      // into its children without incrementing the depth.
      if (parent && skipFn(treeNode) && node.children) {
        for (const child of node.children) {
          toTreeNode(child as T, treeNode, parent.children, depth);
        }
        return;
      }

      if (collection) {
        collection.push(treeNode);
      }

      if (node.children) {
        for (const child of node.children) {
          toTreeNode(child as T, treeNode, treeNode.children, depth + 1);
        }
      }
    }

    for (const item of items) {
      toTreeNode(item, null, roots, 0);
    }

    return new VirtualizedTree<T>(roots, undefined);
  }

  // Returns a list of nodes that are visible in the tree.
  static toExpandedList<T extends TreeLike>(
    nodes: Array<VirtualizedTreeNode<T>>
  ): Array<VirtualizedTreeNode<T>> {
    const list: Array<VirtualizedTreeNode<T>> = [];

    function visit(node: VirtualizedTreeNode<T>): void {
      list.push(node);

      if (!node.expanded) {
        return;
      }

      for (const child of node.children) {
        visit(child);
      }
    }

    for (const node of nodes) {
      visit(node);
    }

    return list;
  }

  findNode(matcher: (item: T) => boolean): VirtualizedTreeNode<T> | null {
    const queue = [...this.roots];

    while (queue.length) {
      const candidate = queue.pop()!;

      if (candidate && matcher(candidate.node)) {
        return candidate;
      }

      for (const child of candidate.children) {
        queue.push(child);
      }
    }

    return null;
  }

  expandToNode(matcher: (item: T) => boolean) {
    // When scrollTo is called, we need to first find a few things
    // - does the element exist in the tree
    // - if it does, what is the index of the element
    // - if it exists, is it visible?
    //   - if it is visible, scroll to it
    //   - if it is not visible, expand its parents and scroll to it
    const node = this.findNode(matcher);

    if (!node) {
      return;
    }

    let path: VirtualizedTreeNode<T> | null = node.parent;
    while (path && !path.expanded) {
      this.expandNode(path, true);
      path = path.parent;
    }
  }

  expandNode(
    node: VirtualizedTreeNode<T>,
    value: boolean,
    opts?: {expandChildren: boolean}
  ) {
    // Because node.setExpanded handles toggling the node and all its children, we still need to update the
    // flattened list. To do that w/o having to rebuild the entire tree, we can just remove the node and add them
    const removedOrAddedNodes = node.setExpanded(value, opts);

    // If toggling the node resulted in no changes to the actual tree, do nothing
    if (!removedOrAddedNodes.length) {
      return removedOrAddedNodes;
    }

    // If a node was expanded, we need to add all of its children to the flattened list.
    if (node.expanded) {
      this.flattened.splice(this.flattened.indexOf(node) + 1, 0, ...removedOrAddedNodes);
    } else {
      // If a node was collapsed, we need to remove all of its children from the flattened list.
      this.flattened.splice(this.flattened.indexOf(node) + 1, removedOrAddedNodes.length);
    }

    return removedOrAddedNodes;
  }

  // Sorts the entire tree and rebuilds the flattened list.
  sort(sortFn: (a: VirtualizedTreeNode<T>, b: VirtualizedTreeNode<T>) => number) {
    if (!this.roots.length) {
      return;
    }

    function visit(node: VirtualizedTreeNode<T>) {
      const sortedChildren = node.children.sort(sortFn);
      for (const sortedChild of sortedChildren) {
        visit(sortedChild);
      }
    }

    const sortedRoots = this.roots.sort(sortFn);
    for (const sortedRoot of sortedRoots) {
      visit(sortedRoot);
    }

    this.flattened = VirtualizedTree.toExpandedList(this.roots);
  }

  getAllExpandedNodes(previouslyExpandedNodes: Set<T>): Set<T> {
    const expandedNodes = new Set<T>(previouslyExpandedNodes);

    function visit(node: VirtualizedTreeNode<T>) {
      if (node.expanded) {
        expandedNodes.add(node.node);
      }

      for (const child of node.children) {
        visit(child);
      }
    }

    for (const root of this.roots) {
      visit(root);
    }

    return expandedNodes;
  }
}
