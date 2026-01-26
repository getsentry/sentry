import type {ReactNode} from 'react';

import type {AndOp} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

export class AndOpTreeNode extends TreeNode<AndOp> {
  renderRow(): ReactNode {
    return <span>Assert All</span>;
  }
}
