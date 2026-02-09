import type {ReactNode} from 'react';

import {OrOpRow} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/rows/orOpRow';
import type {OrOp} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

export class OrOpTreeNode extends TreeNode<OrOp> {
  printNode(): string {
    return `OR - ${this.id}`;
  }

  renderRow(): ReactNode {
    return <OrOpRow node={this} />;
  }
}
