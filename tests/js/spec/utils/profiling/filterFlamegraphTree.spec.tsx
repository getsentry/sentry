import {filterFlamegraphTree} from 'sentry/utils/profiling/filterFlamegraphTree';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

const f = (partial: Partial<FlamegraphFrame & {key: string | number}>) => {
  return {
    key: 0,
    children: [],
    depth: 0,
    end: 0,
    frame: {},
    node: {},
    parent: null,
    start: 0,
    ...partial,
  } as FlamegraphFrame;
};

function assertImmutability(baseNode: FlamegraphFrame, newNode: FlamegraphFrame) {
  const baseNodes = new Map<number, FlamegraphFrame>();
  const newNodes = new Map<number, FlamegraphFrame>();

  function indexNodes(node: FlamegraphFrame, map: Map<any, any>) {
    const stack = [node];
    while (stack.length > 0) {
      const n = stack.pop();

      if (!n) {
        return;
      }
      map.set(n.key, n);

      for (let i = 0; i < n.children.length; i++) {
        stack.push(n.children[i]);
      }
    }
  }

  indexNodes(baseNode, baseNodes);
  indexNodes(newNode, newNodes);

  const max = baseNodes.size > newNodes.size ? baseNodes : newNodes;
  const min = max === baseNodes ? newNodes : baseNodes;

  for (const node of max.values()) {
    expect(node).not.toBe(min.get(node.key));
  }
}

describe('filterFlamegraphTree', () => {
  it('pushes root if it matches', () => {
    const skipFn = (frame: FlamegraphFrame): boolean => {
      return !frame.frame.is_application;
    };

    const root: FlamegraphFrame = f({
      key: 0,
      parent: null,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });

    expect(filterFlamegraphTree([root], skipFn)).toEqual([root]);
  });

  it('pushes child if it has no root', () => {
    const skipFn = (frame: FlamegraphFrame): boolean => {
      return !frame.frame.is_application;
    };

    const root: FlamegraphFrame = f({
      key: 0,
      frame: {is_application: false} as FlamegraphFrame['frame'],
    });
    const child1 = f({
      key: 1,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });

    child1.parent = root;
    root.children = [child1];

    const result = filterFlamegraphTree([root], skipFn);
    expect(result).toEqual([{...child1, parent: null}]);
    assertImmutability(root, result[0]);
  });

  it('persists multiple children', () => {
    const skipFn = (frame: FlamegraphFrame): boolean => {
      return !frame.frame.is_application;
    };

    const root = f({
      key: 0,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });
    const child1 = f({
      key: 1,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });
    const child2 = f({
      key: 2,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });

    child1.parent = root;
    child2.parent = root;
    root.children = [child1, child2];

    const result = filterFlamegraphTree([root], skipFn);
    expect(result[0].children.map(c => c.key)).toEqual([1, 2]);

    assertImmutability(root, result[0]);
  });

  it('skips a level', () => {
    const skipFn = (frame: FlamegraphFrame): boolean => {
      return !frame.frame.is_application;
    };

    const root = f({
      key: 0,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });

    const child1 = f({
      key: 1,
      frame: {is_application: false} as FlamegraphFrame['frame'],
    });

    const child2 = f({
      key: 2,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });

    root.children = [child1];
    child1.children = [child2];

    child1.parent = root;
    child2.parent = child1;

    const result = filterFlamegraphTree([root], skipFn);
    expect(result[0].key).toBe(0);
    expect(result[0].children[0].key).toBe(2);

    assertImmutability(root, result[0]);
  });

  it('persists hierarchy level', () => {
    const skipFn = (frame: FlamegraphFrame): boolean => {
      return !frame.frame.is_application;
    };

    const root = f({
      key: 0,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });

    const child1 = f({
      key: 1,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });

    const child2 = f({
      key: 2,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });

    root.children = [child1];
    child1.children = [child2];

    child1.parent = root;
    child2.parent = child1;

    const result = filterFlamegraphTree([root], skipFn);
    expect(result[0].key).toBe(0);
    expect(result[0].children[0].key).toBe(1);
    expect(result[0].children[0].children[0].key).toBe(2);

    assertImmutability(root, result[0]);
  });

  it('preserves child order', () => {
    const skipFn = (frame: FlamegraphFrame): boolean => {
      return !frame.frame.is_application;
    };

    const root = f({
      key: 0,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });

    const child1 = f({
      key: 1,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });

    const child2 = f({
      key: 3,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });
    const child3 = f({
      key: 2,
      frame: {is_application: true} as FlamegraphFrame['frame'],
    });

    root.children = [child1];
    child1.children = [child2, child3];

    child1.parent = root;
    child2.parent = child1;
    child3.parent = child1;

    const result = filterFlamegraphTree([root], skipFn);
    expect(result[0].key).toBe(0);
    expect(result[0].children[0].key).toBe(1);
    expect(result[0].children[0].children[0].key).toBe(3);
    expect(result[0].children[0].children[1].key).toBe(2);

    assertImmutability(root, result[0]);
  });
});
