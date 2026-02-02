import type {ReactNode} from 'react';

import {JsonPathOpRow} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/rows/jsonPathOpRow';
import type {JsonPathOp} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

export class JsonPathOpTreeNode extends TreeNode<JsonPathOp> {
  renderRow(): ReactNode {
    return <JsonPathOpRow node={this} />;
  }
}
