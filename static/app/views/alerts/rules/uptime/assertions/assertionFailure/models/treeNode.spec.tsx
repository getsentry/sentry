import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  makeAndOp,
  makeJsonPathOp,
  makeStatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/assertions/testUtils';
import type {Op} from 'sentry/views/alerts/rules/uptime/types';

import {TreeNode} from './treeNode';

class MockTreeNode<T extends Op = Op> extends TreeNode<T> {
  renderRow() {
    return (
      <span>
        {this.value.op} - {this.value.id}
      </span>
    );
  }
}

describe('Assertion Failure TreeNode model', () => {
  describe('constructor', () => {
    it('pushes node into parent.children when parent is provided', () => {
      const root = new MockTreeNode(makeAndOp({id: 'op-1'}), null);
      const child1 = new MockTreeNode(makeStatusCodeOp({id: 'op-2'}), root);
      const child2 = new MockTreeNode(makeStatusCodeOp({id: 'op-3'}), root);

      expect(root.children.map(n => n.value.id)).toEqual(['op-2', 'op-3']);
      expect(child1.value.id).toBe('op-2');
      expect(child2.value.id).toBe('op-3');
    });
  });

  describe('depth', () => {
    it('increments per ancestor', () => {
      const root = new MockTreeNode(makeAndOp({id: 'op-1'}), null);
      const parent = new MockTreeNode(makeStatusCodeOp({id: 'op-2'}), root);
      const child = new MockTreeNode(makeJsonPathOp({id: 'op-3'}), parent);

      expect(parent.depth).toBe(1);
      expect(child.depth).toBe(2);
    });
  });

  describe('isLastChild', () => {
    it('is true for root', () => {
      const root = new MockTreeNode(makeAndOp({id: 'op-1'}), null);
      expect(root.isLastChild).toBe(true);
    });

    it('reflects ordering within parent.children', () => {
      const root = new MockTreeNode(makeAndOp({id: 'op-1'}), null);
      const firstChild = new MockTreeNode(makeStatusCodeOp({id: 'op-2'}), root);
      const lastChild = new MockTreeNode(makeStatusCodeOp({id: 'op-3'}), root);

      expect(firstChild.isLastChild).toBe(false);
      expect(lastChild.isLastChild).toBe(true);
    });
  });

  describe('nextOps', () => {
    it('returns children when value has children', () => {
      const leaf1 = makeStatusCodeOp({id: 'op-2'});

      const node = new MockTreeNode(makeAndOp({id: 'op-1', children: [leaf1]}), null);

      expect(node.nextOps.map(op => op.id)).toEqual(['op-2']);
    });
  });

  describe('connectors', () => {
    it('is empty for depth 0', () => {
      const root = new MockTreeNode(makeAndOp({id: 'op-1'}), null);
      expect(root.connectors).toEqual([]);
    });

    it('includes ancestor vertical connector level when ancestor is not last', () => {
      const root = new MockTreeNode(makeAndOp({id: 'op-1'}), null);

      const firstChild = new MockTreeNode(makeAndOp({id: 'op-2'}), root);
      const secondChild = new MockTreeNode(makeAndOp({id: 'op-3'}), root);

      const grandchild = new MockTreeNode(makeAndOp({id: 'op-4'}), firstChild);
      const greatGrandchild = new MockTreeNode(
        makeStatusCodeOp({id: 'op-5'}),
        grandchild
      );

      expect(greatGrandchild.connectors).toEqual([
        {type: 'vertical', depth: 0}, // connector for root -> secondChild
        {type: 'vertical', depth: 2}, // connector for grandchild -> greatGrandchild
        {type: 'horizontal', depth: 2},
      ]);

      expect(secondChild.value.id).toBe('op-3');
    });
  });

  describe('renderRow', () => {
    it('returns a ReactNode for the mock', () => {
      const node = new MockTreeNode(makeStatusCodeOp({id: 'op-1'}), null);

      render(<div>{node.renderRow()}</div>);

      expect(screen.getByText('status_code_check - op-1')).toBeInTheDocument();
    });
  });
});
