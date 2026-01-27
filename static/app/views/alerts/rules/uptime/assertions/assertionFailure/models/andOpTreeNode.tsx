import type {ReactNode} from 'react';

import {AndOpRow} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/rows/andOpRow';
import type {AndOp} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

export class AndOpTreeNode extends TreeNode<AndOp> {
  renderRow(): ReactNode {
    return <AndOpRow />;
  }
}
