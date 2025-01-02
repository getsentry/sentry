import type {TreeLike} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';

import {VirtualizedTreeNode} from './VirtualizedTreeNode';

export class VirtualizedTree<T extends TreeLike> {
  roots: VirtualizedTreeNode<T>[] = [];
  flattened: VirtualizedTreeNode<T>[] = [];

  constructor(roots: VirtualizedTreeNode<T>[], flattenedList?: VirtualizedTreeNode<T>[]) {
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
    const roots: VirtualizedTreeNode<T>[] = [];

    function toTreeNode(
      node: T,
      parent: VirtualizedTreeNode<T> | null,
      collection: VirtualizedTreeNode<T>[] | null,
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
        for (let i = 0; i < node.children.length; i++) {
          toTreeNode(node.children[i] as T, treeNode, parent.children, depth);
        }
        return;
      }

      if (collection) {
        collection.push(treeNode);
      }

      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          toTreeNode(node.children[i] as T, treeNode, treeNode.children, depth + 1);
        }
      }
    }

    for (let i = 0; i < items.length; i++) {
      toTreeNode(items[i]!, null, roots, 0);
    }

    return new VirtualizedTree<T>(roots, undefined);
  }

  // Returns a list of nodes that are visible in the tree.
  static toExpandedList<T extends TreeLike>(
    nodes: VirtualizedTreeNode<T>[]
  ): VirtualizedTreeNode<T>[] {
    const list: VirtualizedTreeNode<T>[] = [];

    function visit(node: VirtualizedTreeNode<T>): void {
      list.push(node);

      if (!node.expanded) {
        return;
      }

      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i]!);
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      visit(nodes[i]!);
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

      for (let i = 0; i < candidate.children.length; i++) {
        queue.push(candidate.children[i]!);
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
      for (let i = 0; i < sortedChildren.length; i++) {
        visit(sortedChildren[i]!);
      }
    }

    const sortedRoots = this.roots.sort(sortFn);
    for (let i = 0; i < sortedRoots.length; i++) {
      visit(sortedRoots[i]!);
    }

    this.flattened = VirtualizedTree.toExpandedList(this.roots);
  }

  getAllExpandedNodes(previouslyExpandedNodes: Set<T>): Set<T> {
    const expandedNodes = new Set<T>(previouslyExpandedNodes);

    function visit(node: VirtualizedTreeNode<T>) {
      if (node.expanded) {
        expandedNodes.add(node.node);
      }

      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i]!);
      }
    }

    for (let i = 0; i < this.roots.length; i++) {
      visit(this.roots[i]!);
    }

    return expandedNodes;
  }
}
