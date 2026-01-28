import type {ReactNode} from 'react';

import {StatusCodeOpRow} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/rows/statusCodeOpRow';
import type {StatusCodeOp} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

export class StatusCodeOpTreeNode extends TreeNode<StatusCodeOp> {
  renderRow(): ReactNode {
    return <StatusCodeOpRow node={this} />;
  }
}
