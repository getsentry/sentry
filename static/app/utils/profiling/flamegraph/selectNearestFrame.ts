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
 *  up    =>
 *          |> if parent is present, goto parent
 *          |> if no parent & previousSibling is present, goto maxDepth of previousSibling
 *          |> if no parent & no previousSibling, no-op
 *  down  =>
 *          |> if immediate child is present, goto first child
 *          |> if no child & walk up to nearest nextSibling
 *          |> if at max depth & no nextSibling, no-op
 *  left  =>
 *          |> walk up to find a node that has a previousSibling
 *          |> walk down the sibling tree following right branches
 *          |> return node matching target depth, if max depth found is less than target return
 *  right => same as left, but we find the right sibling, and follow left branches down until target/max depth is reached
 */
export function selectNearestFrame(frame: FlamegraphFrame, direction: Direction) {
  const targetDepth = frame.depth;
  let parent = frame.parent;
  let node = frame;

  if (direction === 'up') {
    if (parent) {
      return parent;
    }

    if (node.previousSibling) {
      return scanForNearestFrameWithDepth(node.previousSibling, -1, 'left');
    }

    return frame;
  }

  const child = frame.children?.[0];
  if (direction === 'down' && child) {
    return child;
  }

  while (node) {
    const sibling =
      direction === 'right' || direction === 'down'
        ? node.nextSibling!
        : node.previousSibling!;

    if (sibling) {
      if (direction === 'down') {
        return sibling;
      }

      const foundNode = scanForNearestFrameWithDepth(
        sibling,
        targetDepth,
        direction as DirectionX
      );
      return foundNode;
    }

    if (!parent) {
      break;
    }

    node = parent;
    parent = parent.parent;
  }
  return frame;
}

/**
 *  scanForNearestFrameWithDepth will walk down a FlamegraphFrame looking for a target depth.
 *  it will follow either the furthest left or right branch based on direction.
 *  if target depth is not found, we return the frame with the max depth along that branch.
 */
function scanForNearestFrameWithDepth(
  frame: FlamegraphFrame,
  depth: number,
  directionX: DirectionX
) {
  const stack = [frame];

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

    const nextNode = node.children[directionX === 'right' ? 0 : node.children.length - 1];
    if (!nextNode) {
      return node;
    }
    stack.push(nextNode);
  }

  return frame;
}
