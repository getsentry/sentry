import type {ReactNode} from 'react';

import type {JsonPathOp} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

export class JsonPathOpTreeNode extends TreeNode<JsonPathOp> {
  renderRow(): ReactNode {
    return <span>JSON Path</span>;
  }
}
