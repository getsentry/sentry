import type {ReactNode} from 'react';

import type {NotOp} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

export class NotOpTreeNode extends TreeNode<NotOp> {
  override get nextOps() {
    return [this.value.operand];
  }

  renderRow(): ReactNode {
    return <span>Assert NOT</span>;
  }
}
