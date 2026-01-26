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

    it('for depth 1, contains only the horizontal connector', () => {
      const root = new MockTreeNode(makeAndOp({id: 'op-1'}), null);
      const child = new MockTreeNode(makeStatusCodeOp({id: 'op-2'}), root);

      expect(child.connectors).toEqual([
        {type: 'horizontal', left: 12, top: 12, width: 24, height: 1},
      ]);
    });

    it('for depth 2, includes ancestor vertical connector when needed', () => {
      const root = new MockTreeNode(makeAndOp({id: 'op-1'}), null);
      const firstChild = new MockTreeNode(makeStatusCodeOp({id: 'op-2'}), root);
      const secondChild = new MockTreeNode(makeStatusCodeOp({id: 'op-3'}), root); // make `op-2` not last

      const grandchild = new MockTreeNode(makeJsonPathOp({id: 'op-4'}), firstChild);
      expect(grandchild.connectors).toEqual([
        {type: 'vertical', left: 36, top: 0, width: 1, height: 24},
        {type: 'horizontal', left: 36, top: 12, width: 24, height: 1},
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
