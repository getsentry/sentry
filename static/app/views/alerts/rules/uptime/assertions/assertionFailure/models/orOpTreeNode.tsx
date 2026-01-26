import type {ReactNode} from 'react';

import type {OrOp} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

export class OrOpTreeNode extends TreeNode<OrOp> {
  renderRow(): ReactNode {
    return <span>Assert Any</span>;
  }
}
