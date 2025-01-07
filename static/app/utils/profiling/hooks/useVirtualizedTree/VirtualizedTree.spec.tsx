import {VirtualizedTree} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTree';
import type {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';

const n = d => {
  return {...d, children: []};
};

function toFlattenedList(tree: VirtualizedTree<any>): VirtualizedTreeNode<any>[] {
  const list: VirtualizedTreeNode<any>[] = [];

  function visit(node: VirtualizedTreeNode<any>): void {
    list.push(node);

    for (let i = 0; i < node.children.length; i++) {
      visit(node.children[i]!);
    }
  }

  for (let i = 0; i < tree.roots.length; i++) {
    visit(tree.roots[i]!);
  }

  return list;
}

describe('VirtualizedTree', () => {
  describe('fromRoots', () => {
    it('build tree from roots', () => {
      const root = n({id: 'root'});
      const child1 = n({id: 'child1'});
      root.children = [child1];

      const tree = VirtualizedTree.fromRoots([root]);
      tree.expandNode(tree.roots[0]!, true, {expandChildren: true});

      expect(tree.flattened).toHaveLength(2);
    });

    it('skips certain nodes roots', () => {
      const root = n({id: 'root'});
      const child1 = n({id: 'child1'});
      const child2 = n({id: 'child2'});

      root.children = [child1];
      child1.children = [child2];

      const tree = VirtualizedTree.fromRoots([root], false, node => {
        return node.node.id === 'child1';
      });

      tree.expandNode(tree.roots[0]!, true, {expandChildren: true});
      expect(tree.flattened).toHaveLength(2);

      expect(tree.flattened[1]!.depth).toBe(1);
      expect(tree.flattened[1]!.node.id).toBe('child2');
    });
  });
  describe('expandNode', () => {
    it('expands a closed node', () => {
      const root = n({id: 'root'});
      const child1 = n({id: 'child1'});
      root.children = [child1];

      const tree = VirtualizedTree.fromRoots([root]);
      const addedNodes = tree.expandNode(tree.roots[0]!, true);

      expect(addedNodes).toHaveLength(1);

      expect(tree.flattened[1]).toBe(tree.roots[0]!.children[0]);
      expect(tree.flattened).toHaveLength(2);
    });

    it('closes a expanded node', () => {
      const root = n({id: 'root'});
      const child1 = n({id: 'child1'});
      root.children = [child1];

      const tree = VirtualizedTree.fromRoots([root]);

      // Expand all
      tree.expandNode(tree.roots[0]!, true, {expandChildren: true});

      // Close root
      const removedNodes = tree.expandNode(tree.roots[0]!, false);
      expect(removedNodes).toHaveLength(1);

      expect(tree.flattened[0]).toBe(tree.roots[0]);
      expect(tree.flattened).toHaveLength(1);
    });
  });

  describe('toExpandedList', () => {
    it('skips non-expanded nodes', () => {
      const root = n({id: 'root'});
      const child1 = n({id: 'child1'});

      root.children = [child1];
      const tree = VirtualizedTree.fromRoots([root]);

      tree.roots[0]!.setExpanded(false);

      expect(VirtualizedTree.toExpandedList(tree.roots).map(i => i.node.id)).toEqual([
        'root',
      ]);
    });
  });

  describe('sort', () => {
    it('sorts the tree at each level', () => {
      const root = n({id: 'root', weight: 3});
      const child1 = n({id: 'child1', weight: 1});
      const child2 = n({id: 'child2', weight: 2});

      root.children = [child1, child2];

      const tree = VirtualizedTree.fromRoots([root]);
      tree.sort((a, b) => {
        return b.node.weight - a.node.weight;
      });

      expect(toFlattenedList(tree).map(i => i.node.id)).toEqual([
        'root',
        'child2',
        'child1',
      ]);
    });
  });
});
