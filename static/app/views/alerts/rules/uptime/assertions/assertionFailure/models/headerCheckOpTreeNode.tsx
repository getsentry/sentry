import type {ReactNode} from 'react';

import type {HeaderCheckOp} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

export class HeaderCheckOpTreeNode extends TreeNode<HeaderCheckOp> {
  renderRow(): ReactNode {
    return <span>Header Check</span>;
  }
}
