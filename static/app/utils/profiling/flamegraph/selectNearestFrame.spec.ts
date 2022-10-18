import {selectNearestFrame} from './selectNearestFrame';

class Node {
  depth = 0;
  parent: Node | null = null;
  children: Node[] = [];
  previousSibling: Node | null = null;
  nextSibling: Node | null = null;

  constructor(n?: any) {
    Object.assign(this, n);
  }

  addChild() {
    const child = new Node({
      depth: this.depth + 1,
      parent: this,
      children: [],
    });
    if (this.children.length > 0) {
      child.previousSibling = this.children[this.children.length - 1];
      child.previousSibling.nextSibling = child;
    }
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

  it('returns current node when moving up from root', () => {
    const root = new Node();
    const next = selectNearestFrame(root as any, 'up');
    expect(next).toBe(root);
  });

  it('returns current node when at max depth at bottom boundary and no adjacent stack', () => {
    const root = new Node();
    const grandChild = root.addChildrenToDepth(2);
    const next = selectNearestFrame(grandChild as any, 'down');
    expect(next).toBe(grandChild);
  });

  it('moves to top of next stack when moving down at bottom boundary', () => {
    const root = new Node();
    const leftGrandChild = root.addChildrenToDepth(2);
    const rightGrandChild = root.addChildrenToDepth(2);
    const next = selectNearestFrame(leftGrandChild as any, 'down');
    expect(next).toBe(rightGrandChild.parent);
  });
});
