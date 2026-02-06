import type {ReactNode} from 'react';

import {HeaderCheckOpRow} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/rows/headerCheckOpRow';
import type {HeaderCheckOp} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

export class HeaderCheckOpTreeNode extends TreeNode<HeaderCheckOp> {
  printNode(): string {
    return `HEADER CHECK - ${this.id}`;
  }

  renderRow(): ReactNode {
    return <HeaderCheckOpRow node={this} />;
  }
}
