import type {ReactNode} from 'react';

import type {Op} from 'sentry/views/alerts/rules/uptime/types';

export type ConnectorType = 'vertical' | 'horizontal';

export type Connector = {
  depth: number;
  type: ConnectorType;
};

export abstract class TreeNode<T extends Op = Op> {
  value: T;
  parent: TreeNode | null;
  children: TreeNode[];

  constructor(value: T, parent: TreeNode | null = null) {
    this.value = value;
    this.parent = parent;
    this.children = [];

    if (this.parent) {
      this.parent.children.push(this);
    }
  }

  get nextOps(): Op[] {
    return 'children' in this.value ? this.value.children : [];
  }

  get isLastChild(): boolean {
    if (!this.parent) {
      return true;
    }
    return this.parent.children[this.parent.children.length - 1] === this;
  }

  get depth(): number {
    return this.parent ? this.parent.depth + 1 : 0;
  }

  get connectors(): Connector[] {
    if (this.depth === 0) {
      return [];
    }

    const connectors: Connector[] = [];

    // Vertical connectors for ancestor columns.
    let ancestor = this.parent;
    while (ancestor?.parent) {
      if (!ancestor.isLastChild) {
        connectors.push({type: 'vertical', depth: ancestor.depth - 1});
      }
      ancestor = ancestor.parent;
    }

    // Vertical line at the immediate parent's position.
    connectors.push({
      type: 'vertical',
      depth: this.depth - 1,
    });

    // Horizontal connector from parent column to this column.
    connectors.push({
      type: 'horizontal',
      depth: this.depth - 1,
    });

    return connectors;
  }

  abstract renderRow(): ReactNode;
}
