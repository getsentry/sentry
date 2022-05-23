import {VirtualizedTree} from './VirtualizedTree';

const n = d => {
  return {...d, children: []};
};

describe('VirtualizedTree', () => {
  describe('expandNode', () => {
    it('expands a closed node', () => {
      const root = n({id: 'root'});
      const child1 = n({id: 'child1'});
      root.children = [child1];

      const tree = VirtualizedTree.fromRoots([root]);
      const addedNodes = tree.expandNode(tree.roots[0], true);

      expect(addedNodes.length).toBe(1);

      expect(tree.flattened[1]).toBe(tree.roots[0].children[0]);
      expect(tree.flattened).toHaveLength(2);
    });

    it('closes a expanded node', () => {
      const root = n({id: 'root'});
      const child1 = n({id: 'child1'});
      root.children = [child1];

      const tree = VirtualizedTree.fromRoots([root]);

      // Expand all
      tree.expandNode(tree.roots[0], true, {expandChildren: true});

      // Close root
      const removedNodes = tree.expandNode(tree.roots[0], false);
      expect(removedNodes.length).toBe(1);

      expect(tree.flattened[0]).toBe(tree.roots[0]);
      expect(tree.flattened).toHaveLength(1);
    });
  });

  describe('toFlattenedList', () => {
    it('flattens single level', () => {
      const root = n({id: 'root'});
      const child1 = n({id: 'child1'});
      const child2 = n({id: 'child2'});

      root.children = [child1, child2];
      const tree = VirtualizedTree.fromRoots([root]);

      expect(tree.toFlattenedList().map(i => i.node.id)).toEqual([
        'root',
        'child1',
        'child2',
      ]);
    });

    it('flattens via dfs', () => {
      const root = n({id: 'root'});
      const child1 = n({id: 'child1'});
      const child2 = n({id: 'child2'});

      const child1_1 = n({id: 'child1_1'});
      const child1_2 = n({id: 'child1_2'});

      const child1_1_1 = n({id: 'child1_1_1'});

      root.children = [child1, child2];
      child1.children = [child1_1, child1_2];
      child1_1.children = [child1_1_1];

      const tree = VirtualizedTree.fromRoots([root]);

      expect(tree.toFlattenedList().map(i => i.node.id)).toEqual([
        'root',
        'child1',
        'child1_1',
        'child1_1_1',
        'child1_2',
        'child2',
      ]);
    });
  });

  describe('toExpandedList', () => {
    it('skips non-expanded nodes', () => {
      const root = n({id: 'root'});
      const child1 = n({id: 'child1'});

      root.children = [child1];
      const tree = VirtualizedTree.fromRoots([root]);

      tree.roots[0].setExpanded(false);
      expect(tree.toExpandedList().map(i => i.node.id)).toEqual(['root']);
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

      expect(tree.toFlattenedList().map(i => i.node.id)).toEqual([
        'root',
        'child2',
        'child1',
      ]);
    });
  });
});
