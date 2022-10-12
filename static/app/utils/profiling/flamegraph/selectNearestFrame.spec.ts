import {selectNearestFrame} from './selectNearestFrame';

class Node {
  depth = 0;
  parent: Node | null = null;
  children: Node[] = [];

  constructor(n?: any) {
    Object.assign(this, n);
  }

  addChild() {
    const child = new Node({
      depth: this.depth + 1,
      parent: this,
      children: [],
    });
    this.children.push(child);
    return child;
  }

  addChildrenToDepth(n: number) {
    let node = this;
    Array.from(Array(n)).forEach(() => {
      // @ts-ignore
      node = node.addChild();
    });
    return node;
  }
}

describe('selectNearestFrame', () => {
  it('selects a first child frame when walking down', () => {
    const root = new Node();
    const firstChild = root.addChild();

    const next = selectNearestFrame(root as any, 'down');
    expect(next).toBe(firstChild);
  });
  it('selects parent when walking up', () => {
    const root = new Node();
    const firstChild = root.addChild();
    const next = selectNearestFrame(firstChild as any, 'up');
    expect(next).toBe(root);
  });

  it('selects nearest right node with same target depth', () => {
    const root = new Node();
    const leftGrandChild = root.addChildrenToDepth(2);
    const rightGrandChild = root.addChildrenToDepth(2);
    const next = selectNearestFrame(leftGrandChild as any, 'right');
    expect(next).toBe(rightGrandChild);
    expect(next!.depth).toBe(rightGrandChild.depth);
  });

  it('selects nearest right node to its max depth', () => {
    const root = new Node();
    const leftGrandChild = root.addChildrenToDepth(4);
    const rightGrandChild = root.addChildrenToDepth(2);
    const next = selectNearestFrame(leftGrandChild as any, 'right');
    expect(next).toBe(rightGrandChild);
    expect(next!.depth).not.toBe(leftGrandChild.depth);
  });

  it('selects nearest left node with same target depth', () => {
    const root = new Node();
    const leftGrandChild = root.addChildrenToDepth(2);
    const rightGrandChild = root.addChildrenToDepth(2);
    const next = selectNearestFrame(rightGrandChild as any, 'left');
    expect(next).toBe(leftGrandChild);
    expect(next!.depth).toBe(rightGrandChild.depth);
  });

  it('selects nearest left node to its max depth', () => {
    const root = new Node();
    const leftGrandChild = root.addChildrenToDepth(2);
    const rightGrandChild = root.addChildrenToDepth(4);
    const next = selectNearestFrame(rightGrandChild as any, 'left');
    expect(next).toBe(leftGrandChild);
    expect(next!.depth).not.toBe(rightGrandChild.depth);
  });

  it('returns null when moving up from root', () => {
    const root = new Node();
    const next = selectNearestFrame(root as any, 'up');
    expect(next).toBe(null);
  });
});
