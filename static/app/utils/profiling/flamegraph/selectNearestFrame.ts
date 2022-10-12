import {FlamegraphFrame} from '../flamegraphFrame';

export type DirectionX = 'left' | 'right';
export type DirectionY = 'up' | 'down';
export type Direction = DirectionY | DirectionX;
/**
 * selectNearestFrame walks a FlamegraphFrame tree the direction specified and returns the nearest
 * FlamegraphFrame relative to the starting node.
 *
 * below is a gist of the walking algorithm:
 *
 *  up    => frame's parent
 *  down  => frame's first child
 *  left  =>
 *          |> walk up to find a parent that contains the current frame w/ a sibling to the left
 *          |> walk down the sibling tree following right branches
 *          |> return node matching target depth, if max depth found is less than target return
 *  right => same as left, but we find the right sibling, and follow left branches down until target/max depth is reached
 */
export function selectNearestFrame(n: FlamegraphFrame, dir: Direction) {
  if (!n) {
    return null;
  }

  const targetDepth = n.depth;
  let parent = n.parent;
  let node = n;

  if (dir === 'up' && parent) {
    return parent;
  }

  const child = n.children?.[0];
  if (dir === 'down' && child) {
    return child;
  }

  while (parent) {
    const indexOfChild = parent.children.indexOf(node);
    if (indexOfChild === -1) {
      return n;
    }
    const hasSiblings =
      dir === 'right' ? indexOfChild < parent.children.length - 1 : indexOfChild > 0;

    if (hasSiblings) {
      const siblingOffset = dir === 'right' ? 1 : -1;
      const sibling = parent.children[indexOfChild + siblingOffset];
      const foundNode = scanForNearestFrameWithDepth(
        sibling,
        targetDepth,
        dir as DirectionX
      );
      return foundNode;
    }

    node = parent;
    parent = parent.parent;
  }
  return null;
}
/**
 *  scanForNearestFrameWithDepth will walk down a FlamegraphFrame looking for a target depth.
 *  it will follow either the furthest left or right branch based on direction.
 *  if target depth is not found, we return the frame with the max depth along that branch.
 */
function scanForNearestFrameWithDepth(
  n: FlamegraphFrame,
  depth: number,
  dir: DirectionX
) {
  const stack = [n];

  while (stack.length) {
    const node = stack.pop();
    if (!node) {
      return node;
    }
    if (node.depth === depth) {
      return node;
    }
    if (!node.children) {
      continue;
    }

    const nextNode = node.children[dir === 'right' ? 0 : node.children.length - 1];
    if (!nextNode) {
      return node;
    }
    stack.push(nextNode);
  }

  return n;
}
