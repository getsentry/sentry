import {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';

describe('VirtualizedTreeNode', () => {
  describe('getVisibleChildrenCount', () => {
    it('should return 0 if the node is not expanded', () => {
      const root = new VirtualizedTreeNode({id: 0}, null, 0);
      const child_1 = new VirtualizedTreeNode({id: 1}, root, 1);
      const child_2 = new VirtualizedTreeNode({id: 2}, root, 1);

      root.children = [child_1, child_2];
      expect(root.getVisibleChildrenCount()).toBe(0);
    });

    it('should return children count if the root is expanded', () => {
      const root = new VirtualizedTreeNode({id: 0}, null, 0);
      const child_1 = new VirtualizedTreeNode({id: 1}, root, 1);
      const child_2 = new VirtualizedTreeNode({id: 2}, root, 1);

      root.children = [child_1];
      child_1.children = [child_2];

      root.setExpanded(true);
      expect(root.getVisibleChildrenCount()).toBe(1);
      child_1.setExpanded(true);
      expect(root.getVisibleChildrenCount()).toBe(2);
    });
  });

  describe('setExpanded', () => {
    it('expands node', () => {
      const root = new VirtualizedTreeNode({id: 0}, null, 0);
      const child_1 = new VirtualizedTreeNode({id: 1}, root, 1);

      root.children = [child_1];

      root.setExpanded(true, {expandChildren: false});
      expect(root.expanded).toBe(true);
      expect(child_1.expanded).toBe(false);
    });
    it('expands all children', () => {
      const root = new VirtualizedTreeNode({id: 0}, null, 0);
      const child_1 = new VirtualizedTreeNode({id: 1}, root, 1);
      const child_2 = new VirtualizedTreeNode({id: 2}, root, 1);

      root.children = [child_1];
      child_1.children = [child_2];

      root.setExpanded(true, {expandChildren: true});
      expect(root.expanded).toBe(true);
      expect(child_1.expanded).toBe(true);
      expect(child_2.expanded).toBe(true);
    });
  });
});
