import {DeepPartial} from 'sentry/types/utils';

import {FlamegraphFrame} from '../flamegraphFrame';

import {selectNearestFrame} from './flamegraphKeyboardNavigation';

function createFlamegraphFrame(frame?: DeepPartial<FlamegraphFrame>) {
  const {
    depth = 0,
    parent = null,
    children = [],
    frame: _frame = {
      isRoot: false,
    },
  } = frame ?? {};
  return {
    frame: _frame,
    depth,
    parent,
    children,
  } as FlamegraphFrame;
}

function addChild(frame: FlamegraphFrame) {
  const child = createFlamegraphFrame({
    parent: frame,
    depth: frame.depth + 1,
    children: [],
  });
  frame.children.push(child);

  return child;
}

function addChildrenToDepth(frame: FlamegraphFrame, n: number) {
  let node = frame;
  Array.from(Array(n)).forEach(() => {
    node = addChild(node);
  });
  return node;
}

describe('selectNearestFrame', () => {
  it('selects a first child frame when walking down', () => {
    const root = createFlamegraphFrame();
    const firstChild = addChild(root);

    const next = selectNearestFrame(root as any, 'down');
    expect(next).toBe(firstChild);
  });
  it('selects parent when walking up', () => {
    const root = createFlamegraphFrame();
    const firstChild = addChild(root);
    const next = selectNearestFrame(firstChild as any, 'up');
    expect(next).toBe(root);
  });

  it('selects nearest right node with same target depth', () => {
    const root = createFlamegraphFrame();
    const leftGrandChild = addChildrenToDepth(root, 2);
    const rightGrandChild = addChildrenToDepth(root, 2);
    const next = selectNearestFrame(leftGrandChild as any, 'right');
    expect(next).toBe(rightGrandChild);
    expect(next!.depth).toBe(rightGrandChild.depth);
  });

  it('selects nearest right node to its max depth', () => {
    const root = createFlamegraphFrame();
    const leftGrandChild = addChildrenToDepth(root, 4);
    const rightGrandChild = addChildrenToDepth(root, 2);
    const next = selectNearestFrame(leftGrandChild as any, 'right');
    expect(next).toBe(rightGrandChild);
    expect(next!.depth).not.toBe(leftGrandChild.depth);
  });

  it('selects nearest left node with same target depth', () => {
    const root = createFlamegraphFrame();
    const leftGrandChild = addChildrenToDepth(root, 2);
    const rightGrandChild = addChildrenToDepth(root, 2);
    const next = selectNearestFrame(rightGrandChild as any, 'left');
    expect(next).toBe(leftGrandChild);
    expect(next!.depth).toBe(rightGrandChild.depth);
  });

  it('selects nearest left node to its max depth', () => {
    const root = createFlamegraphFrame();
    const leftGrandChild = addChildrenToDepth(root, 2);
    const rightGrandChild = addChildrenToDepth(root, 4);
    const next = selectNearestFrame(rightGrandChild as any, 'left');
    expect(next).toBe(leftGrandChild);
    expect(next!.depth).not.toBe(rightGrandChild.depth);
  });

  it('returns current node when moving up from root', () => {
    const root = createFlamegraphFrame();
    const next = selectNearestFrame(root as any, 'up');
    expect(next).toBe(root);
  });

  it('returns current node when at max depth at bottom boundary and no adjacent stack', () => {
    const root = createFlamegraphFrame();
    const grandChild = addChildrenToDepth(root, 2);
    const next = selectNearestFrame(grandChild as any, 'down');
    expect(next).toBe(grandChild);
  });

  it('moves to top of next stack when moving down at bottom boundary', () => {
    const root = createFlamegraphFrame();
    const leftGrandChild = addChildrenToDepth(root, 2);
    const rightGrandChild = addChildrenToDepth(root, 2);
    const next = selectNearestFrame(leftGrandChild as any, 'down');
    expect(next).toBe(rightGrandChild.parent);
  });

  it('does not allow selection of the "sentry root" virtual root node', () => {
    const root = createFlamegraphFrame({
      frame: {
        isRoot: true,
      },
    });
    const leftChild = addChildrenToDepth(root, 1);
    const next = selectNearestFrame(leftChild as any, 'up');
    expect(next).toBe(leftChild);
  });
});
