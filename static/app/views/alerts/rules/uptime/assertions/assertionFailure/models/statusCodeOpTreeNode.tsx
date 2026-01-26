import type {ReactNode} from 'react';

import type {StatusCodeOp} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

export class StatusCodeOpTreeNode extends TreeNode<StatusCodeOp> {
  renderRow(): ReactNode {
    return <span>Status Code</span>;
  }
}
