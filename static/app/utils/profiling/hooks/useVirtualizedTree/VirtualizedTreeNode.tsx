export class VirtualizedTreeNode<T> {
  node: T;
  parent: VirtualizedTreeNode<T> | null;
  children: VirtualizedTreeNode<T>[];
  expanded: boolean;
  depth: number;

  constructor(
    node: T,
    parent: VirtualizedTreeNode<T> | null,
    depth: number,
    expanded: boolean = false
  ) {
    this.node = node;
    this.parent = parent;
    this.expanded = expanded ?? false;
    this.children = [];
    this.depth = depth;
  }

  getVisibleChildrenCount(): number {
    if (!this.expanded || !this.children.length) {
      return 0;
    }

    let count = 0;
    const queue = [...this.children];

    while (queue.length > 0) {
      const next = queue.pop();
      if (next === undefined) {
        throw new Error('Undefined queue node, this should never happen');
      }

      if (next.expanded) {
        for (let i = 0; i < next.children.length; i++) {
          queue.push(next.children[i]);
        }
      }
      count++;
    }

    return count;
  }

  setExpanded(value: boolean, opts?: {expandChildren: boolean}) {
    if (value === this.expanded) {
      return [];
    }

    // We are closing a node, so we need to remove all of its children. To do that, we just get the
    // count of visible children and return it.
    if (!value) {
      const removedCount = this.getVisibleChildrenCount();
      this.expanded = value;
      return new Array(removedCount);
    }

    // If we are opening a node, we need to add all of its children to the list and insert it
    this.expanded = value;

    // Collect the newly visible children.
    const list: VirtualizedTreeNode<T>[] = [];
    function visit(node: VirtualizedTreeNode<T>): void {
      if (opts?.expandChildren) {
        node.expanded = true;
      }

      list.push(node);

      if (!node.expanded) {
        return;
      }

      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i]);
      }
    }

    for (let i = 0; i < this.children.length; i++) {
      visit(this.children[i]);
    }

    return list;
  }
}
