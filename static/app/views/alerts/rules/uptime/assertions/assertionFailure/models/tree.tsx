import {
  isAndOp,
  isGroupOp,
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
    tree.mergeLogicalOps();
    tree.nodes = tree.flatten();
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

    throw new Error('Unknown uptime assertion op');
  }

  private static buildNode(op: Op, parent: TreeNode | null): TreeNode {
    const node = Tree.nodeFromOp(op, parent);

    for (const nextOp of node.nextOps) {
      Tree.buildNode(nextOp, node);
    }

    return node;
  }

  private flatten(): TreeNode[] {
    const nodes: TreeNode[] = [];

    const visit = (node: TreeNode) => {
      nodes.push(node);
      node.children.forEach(visit);
    };

    if (this.root) {
      visit(this.root);
    }

    return nodes;
  }

  private removeNode(node: TreeNode): void {
    const nodeIsRoot = node === this.root;
    if (nodeIsRoot) {
      // If the root has multiple children, removing it would require introducing
      // a new synthetic root; we don't do that here.
      if (node.children.length > 1) {
        return;
      }

      // Replace the root with its only child
      const newRoot = node.children[0] ?? null;
      if (newRoot) {
        newRoot.parent = null;
      }
      this.root = newRoot;

      // Fully detach the removed node.
      node.parent = null;
      node.children = [];
      return;
    }

    const parent = node.parent;
    if (!parent) {
      return;
    }

    const index = parent.children.indexOf(node);
    if (index === -1) {
      return;
    }

    const children = node.children;

    // For non-root nodes, we just replace the node with its children.
    parent.children.splice(index, 1, ...children);

    for (const child of children) {
      child.parent = parent;
    }

    // Fully detach the removed node.
    node.parent = null;
    node.children = [];
  }

  private mergeLogicalOps(): void {
    const visit = (node: TreeNode) => {
      const parent = node.parent;

      // If the node is a GROUP op and its parent is a NOT op
      // we negate the node. This is done to simplify the tree.
      // Example: 'Assert NOT then Assert All' to 'Assert None'
      if (
        isGroupOp(node.value) &&
        parent &&
        isNotOp(parent.value) &&
        parent.children.length === 1
      ) {
        node.isNegated = true;
        this.removeNode(parent);
      }
      node.children.forEach(visit);
    };

    if (this.root) {
      visit(this.root);

      // The root is always forced to be an AND op.
      // After the logical ops have been merged, if the root has only one GROUP op child,
      // we can remove the root to simplify the tree.
      // Example: 'Assert All then Assert Any' to just 'Assert Any'
      if (this.root && this.root.children.length === 1) {
        const child = this.root.children[0];
        if (child && isGroupOp(child.value)) {
          this.removeNode(this.root);
        }
      }
    }
  }
}
