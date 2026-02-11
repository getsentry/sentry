import type {ReactNode} from 'react';

import {NotOpRow} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/rows/notOpRow';
import type {NotOp} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

export class NotOpTreeNode extends TreeNode<NotOp> {
  override get nextOps() {
    return [this.value.operand];
  }

  printNode(): string {
    return `NOT - ${this.id}`;
  }

  renderRow(): ReactNode {
    return <NotOpRow />;
  }
}
