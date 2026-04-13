import type {ReactNode} from 'react';

import {StatusCodeOpRow} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/rows/statusCodeOpRow';
import type {UptimeStatusCodeOp} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

export class StatusCodeOpTreeNode extends TreeNode<UptimeStatusCodeOp> {
  printNode(): string {
    return `STATUS CODE - ${this.id}`;
  }

  renderRow(): ReactNode {
    return <StatusCodeOpRow node={this} />;
  }
}
