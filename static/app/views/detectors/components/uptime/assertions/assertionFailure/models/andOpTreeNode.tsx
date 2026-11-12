import type {ReactNode} from 'react';

import {AndOpRow} from 'sentry/views/detectors/components/uptime/assertions/assertionFailure/rows/andOpRow';
import type {UptimeAndOp} from 'sentry/views/detectors/components/uptime/types';

import {TreeNode} from './treeNode';

export class AndOpTreeNode extends TreeNode<UptimeAndOp> {
  printNode(): string {
    return `AND - ${this.id}`;
  }

  renderRow(): ReactNode {
    return <AndOpRow node={this} />;
  }
}
