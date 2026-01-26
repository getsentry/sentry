import type {ReactNode} from 'react';

import type {Op} from 'sentry/views/alerts/rules/uptime/types';

export type ConnectorType = 'vertical' | 'horizontal';

interface Connector {
  height: number;
  left: number;
  top: number;
  type: ConnectorType;
  width: number;
}

const CONNECTOR_THICKNESS_PX = 1;
const ROW_HEIGHT_PX = 24;
const INDENT_PX = 24;

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
    const midY = Math.floor(ROW_HEIGHT_PX / 2);

    // Ancestor vertical connectors (for siblings that continue below).
    let ancestor = this.parent;
    while (ancestor) {
      if (!ancestor.isLastChild) {
        connectors.push({
          type: 'vertical',
          left: leftOffsetFromLevel(ancestor.depth),
          top: 0,
          width: CONNECTOR_THICKNESS_PX,
          height: ROW_HEIGHT_PX,
        });
      }
      ancestor = ancestor.parent;
    }

    // Horizontal connector from parent column to this column.
    connectors.push({
      type: 'horizontal',
      left: leftOffsetFromLevel(this.depth - 1),
      top: midY,
      width: INDENT_PX,
      height: CONNECTOR_THICKNESS_PX,
    });

    return connectors;
  }

  abstract renderRow(): ReactNode;
}

function leftOffsetFromLevel(level: number): number {
  return level * INDENT_PX + Math.floor(INDENT_PX / 2);
}
