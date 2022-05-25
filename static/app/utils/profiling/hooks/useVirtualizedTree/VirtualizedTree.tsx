import {VirtualizedTreeNode} from './VirtualizedTreeNode';

interface TreeLike {
  children: TreeLike[];
}
export class VirtualizedTree<T extends TreeLike> {
  roots: VirtualizedTreeNode<T>[] = [];
  flattened: VirtualizedTreeNode<T>[] = [];

  constructor(roots: VirtualizedTreeNode<T>[], flattenedList?: VirtualizedTreeNode<T>[]) {
    this.roots = roots;
    this.flattened = flattenedList || VirtualizedTree.toExpandedList(this.roots);
  }

  // Rebuilds the tree
  static fromRoots<T extends TreeLike>(items: T[]): VirtualizedTree<T> {
    const roots: VirtualizedTreeNode<T>[] = [];

    function toTreeNode(
      node: T,
      parent: VirtualizedTreeNode<T> | null,
      collection: VirtualizedTreeNode<T>[] | null,
      depth: number
    ) {
      const treeNode = new VirtualizedTreeNode<T>(node, parent, depth);

      if (collection) {
        collection.push(treeNode);
      }

      for (let i = 0; i < node.children.length; i++) {
        toTreeNode(node.children[i] as T, treeNode, treeNode.children, depth + 1);
      }
    }

    for (let i = 0; i < items.length; i++) {
      toTreeNode(items[i], null, roots, 0);
    }

    return new VirtualizedTree<T>(roots);
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
        visit(node.children[i]);
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      visit(nodes[i]);
    }

    return list;
  }

  expandNode(
    node: VirtualizedTreeNode<T>,
    value: boolean,
    opts?: {expandChildren: boolean}
  ) {
    // Because node.setExpanded handles toggling the node and all it's children, we still need to update the
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
        visit(sortedChildren[i]);
      }
    }

    const sortedRoots = this.roots.sort(sortFn);
    for (let i = 0; i < sortedRoots.length; i++) {
      visit(sortedRoots[i]);
    }

    this.flattened = VirtualizedTree.toExpandedList(this.roots);
  }
}
