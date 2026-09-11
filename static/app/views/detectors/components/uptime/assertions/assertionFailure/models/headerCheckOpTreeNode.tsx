import type {ReactNode} from 'react';

import {HeaderCheckOpRow} from 'sentry/views/detectors/components/uptime/assertions/assertionFailure/rows/headerCheckOpRow';
import type {UptimeHeaderCheckOp} from 'sentry/views/detectors/components/uptime/types';

import {TreeNode} from './treeNode';

export class HeaderCheckOpTreeNode extends TreeNode<UptimeHeaderCheckOp> {
  printNode(): string {
    return `HEADER CHECK - ${this.id}`;
  }

  renderRow(): ReactNode {
    return <HeaderCheckOpRow node={this} />;
  }
}
