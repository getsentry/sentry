import {
  isAndOp,
  isHeaderCheckOp,
  isJsonPathOp,
  isNotOp,
  isOrOp,
  isStatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/assertions/typeGuards';
import type {Assertion, Op} from 'sentry/views/alerts/rules/uptime/types';

import {AndOpTreeNode} from './andOpTreeNode';
import {HeaderCheckOpTreeNode} from './headerCheckOpTreeNode';
import {JsonPathOpTreeNode} from './jsonPathOpTreeNode';
import {NotOpTreeNode} from './notOpTreeNode';
import {OrOpTreeNode} from './orOpTreeNode';
import {StatusCodeOpTreeNode} from './statusCodeOpTreeNode';
import type {TreeNode} from './treeNode';

export class Tree {
  root: TreeNode | null;
  nodes: TreeNode[] = [];

  constructor(root: TreeNode | null = null) {
    this.root = root;
  }

  static FromAssertion(assertion: Assertion): Tree {
    const root = Tree.buildNode(assertion.root, null);

    const tree = new Tree(root);
    tree.nodes = Tree.flatten(root);
    return tree;
  }

  private static nodeFromOp(op: Op, parent: TreeNode | null): TreeNode {
    if (isAndOp(op)) {
      return new AndOpTreeNode(op, parent);
    }
    if (isOrOp(op)) {
      return new OrOpTreeNode(op, parent);
    }
    if (isNotOp(op)) {
      return new NotOpTreeNode(op, parent);
    }

    if (isStatusCodeOp(op)) {
      return new StatusCodeOpTreeNode(op, parent);
    }
    if (isJsonPathOp(op)) {
      return new JsonPathOpTreeNode(op, parent);
    }
    if (isHeaderCheckOp(op)) {
      return new HeaderCheckOpTreeNode(op, parent);
    }

    // Should be unreachable if `Op` stays in sync.
    throw new Error('Unknown uptime assertion op');
  }

  private static buildNode(op: Op, parent: TreeNode | null): TreeNode {
    const node = Tree.nodeFromOp(op, parent);

    for (const nextOp of node.nextOps) {
      Tree.buildNode(nextOp, node);
    }

    return node;
  }

  private static flatten(root: TreeNode): TreeNode[] {
    const out: TreeNode[] = [];

    const walk = (node: TreeNode) => {
      out.push(node);
      node.children.forEach(walk);
    };

    walk(root);
    return out;
  }
}
