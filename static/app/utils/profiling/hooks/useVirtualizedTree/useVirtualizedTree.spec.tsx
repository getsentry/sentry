import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {useVirtualizedTree} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';

const n = (d: any) => {
  return {...d, children: []};
};

// Creates a tree with N nodes where each node has only one child
const chain = (prefix: string, depth: number) => {
  let node = n({id: `${prefix}-0`});
  let start = 1;
  // Keep a root reference so we can return it
  const root = node;

  // Build a tree of nodes with each node having only one child
  while (start < depth) {
    const child = n({id: `${prefix}-${start}`});
    node.children = [child];
    // Swap the current node
    node = child;
    start++;
  }

  return root;
};

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;
window.requestAnimationFrame = (cb: Function) => cb();

const makeScrollContainerMock = ({height}: {height: number}) => {
  return {
    getBoundingClientRect: () => {
      return {height};
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as HTMLElement;
};

describe('useVirtualizedTree', () => {
  it('returns a tree', () => {
    const results = renderHook(useVirtualizedTree, {
      initialProps: {
        overscroll: 0,
        rowHeight: 10,
        tree: [],
        scrollContainer: null,
        renderRow: () => <div />,
      },
    });

    expect(results.result.current.items).toEqual([]);
  });

  it('expands tree', () => {
    const mockScrollContainer = makeScrollContainerMock({height: 100});

    const tree = [chain('child', 5)];

    const {result} = renderHook(useVirtualizedTree, {
      initialProps: {
        expanded: true,
        rowHeight: 10,
        scrollContainer: mockScrollContainer,
        overscroll: 0,
        tree,
        renderRow: () => <div />,
      },
    });

    expect(result.current.items).toHaveLength(5);
  });

  it('shows first 10 items', () => {
    const mockScrollContainer = makeScrollContainerMock({height: 100});

    const tree = [chain('child', 10)];

    const {result} = renderHook(useVirtualizedTree, {
      initialProps: {
        rowHeight: 10,
        scrollContainer: mockScrollContainer,
        overscroll: 0,
        tree,
        renderRow: () => <div />,
      },
    });

    act(() => {
      result.current.handleExpandTreeNode(
        result.current.tree.roots[0]!,
        !result.current.tree.roots[0]!.expanded,
        {
          expandChildren: true,
        }
      );
    });

    for (let i = 0; i < 10; i++) {
      expect(result.current.items[i]!.item.node.id).toBe(`child-${i}`);
    }
    expect(result.current.items).toHaveLength(10);
  });

  it('shows 5-15 items', async () => {
    const mockScrollContainer = makeScrollContainerMock({height: 100});

    const tree = [chain('child', 20)];

    const {result} = renderHook(useVirtualizedTree, {
      initialProps: {
        rowHeight: 10,
        scrollContainer: mockScrollContainer,
        overscroll: 0,
        tree,
        renderRow: () => <div />,
      },
    });

    act(() => {
      result.current.handleExpandTreeNode(
        result.current.tree.roots[0]!,
        !result.current.tree.roots[0]!.expanded,
        {
          expandChildren: true,
        }
      );
      result.current.dispatch({type: 'set scroll top', payload: 50});
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(10);
    });
    for (let i = 0; i < 10; i++) {
      expect(result.current.items[i]!.item.node.id).toBe(`child-${i + 5}`);
    }
    expect(result.current.items).toHaveLength(10);
  });

  it('shows last 10 items', async () => {
    const mockScrollContainer = makeScrollContainerMock({height: 100});

    const tree = [chain('child', 20)];

    const {result} = renderHook(useVirtualizedTree, {
      initialProps: {
        rowHeight: 10,
        scrollContainer: mockScrollContainer,
        overscroll: 0,
        tree,
        renderRow: () => <div />,
      },
    });

    act(() => {
      result.current.handleExpandTreeNode(
        result.current.tree.roots[0]!,
        !result.current.tree.roots[0]!.expanded,
        {
          expandChildren: true,
        }
      );
      result.current.dispatch({type: 'set scroll top', payload: 100});
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(10);
    });
    for (let i = 0; i < 10; i++) {
      expect(result.current.items[i]!.item.node.id).toBe(`child-${i + 10}`);
    }
    expect(result.current.items).toHaveLength(10);
  });

  it('shows overscroll items', () => {
    const mockScrollContainer = makeScrollContainerMock({height: 100});

    const tree = [chain('child', 20)];

    const {result} = renderHook(useVirtualizedTree, {
      initialProps: {
        rowHeight: 10,
        scrollContainer: mockScrollContainer,
        overscroll: 2,
        tree,
        renderRow: () => <div />,
      },
    });

    act(() => {
      result.current.handleExpandTreeNode(
        result.current.tree.roots[0]!,
        !result.current.tree.roots[0]!.expanded,
        {
          expandChildren: true,
        }
      );
      result.current.dispatch({type: 'set scroll top', payload: 50});
    });

    for (let i = 3; i < 17; i++) {
      // Should display nodes 5-15, but since we use overscroll, it should display nodes 3-17
      expect(result.current.items[i - 3]!.item.node.id).toBe(`child-${i}`);
    }
    expect(result.current.items).toHaveLength(14);
  });

  it('items have a stable key', () => {
    const mockScrollContainer = makeScrollContainerMock({height: 100});

    const tree = [chain('child', 20)];

    const {result} = renderHook(useVirtualizedTree, {
      initialProps: {
        rowHeight: 10,
        scrollContainer: mockScrollContainer,
        overscroll: 0,
        tree,
        renderRow: () => <div />,
      },
    });

    act(() => {
      result.current.handleExpandTreeNode(
        result.current.tree.roots[0]!,
        !result.current.tree.roots[0]!.expanded,
        {
          expandChildren: true,
        }
      );
      result.current.dispatch({type: 'set scroll top', payload: 50});
    });

    const stableKeys = result.current.items.map(item => item.key);

    act(() => {
      result.current.dispatch({type: 'set scroll top', payload: 60});
    });

    // First 9 items should be the same, the last item should be different
    for (let i = 1; i < stableKeys.length; i++) {
      expect(stableKeys[i]!).toBe(result.current.items[i - 1]!.key);
    }

    // Last item should be different
    expect(result.current.items[result.current.items.length - 1]!.key).toBe(
      stableKeys[stableKeys.length - 1]! + 1
    );
  });
});
