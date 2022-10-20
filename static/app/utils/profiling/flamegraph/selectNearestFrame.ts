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
  const parent = frame.parent;
  const node = frame;

  if (direction === 'up') {
    if (parent) {
      return parent;
    }

    const leftSibling = getSibling(node, 'left');
    if (leftSibling) {
      return leftSibling;
    }

    return frame;
  }

  const child = frame.children?.[0];
  if (direction === 'down') {
    if (child) {
      return child;
    }
    const sibling = scanForNearestSibling(node, 'right');
    if (sibling) {
      return sibling;
    }

    return frame;
  }

  const sibling = scanForNearestSibling(node, direction);

  if (sibling) {
    const nodeWithDepth = scanForNearestFrameWithDepth(sibling, targetDepth, direction);
    if (nodeWithDepth) {
      return nodeWithDepth;
    }
  }

  return frame;
}

function scanForNearestSibling(frame: FlamegraphFrame, directionX: DirectionX) {
  let node = frame;
  while (node) {
    let parent = node.parent;
    const sibling = getSibling(node, directionX);

    if (sibling) {
      return sibling;
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
  let node = frame;
  let nextNode = node.children[directionX === 'right' ? 0 : node.children.length - 1];

  while (node && nextNode) {
    if (node.depth === depth) {
      return node;
    }

    nextNode = node.children[directionX === 'right' ? 0 : node.children.length - 1];
    if (nextNode) {
      node = nextNode;
    }
  }

  return node;
}

function getSibling(frame: FlamegraphFrame, directionX: DirectionX) {
  const parent = frame.parent;
  if (!parent) {
    return null;
  }

  const indexOfFrame = parent.children.indexOf(frame);
  // this should never happen, it would make our data structure invalid
  if (indexOfFrame === -1) {
    throw Error('frame.parent.children does not include current frame');
  }

  if (directionX === 'right') {
    const hasRightSiblings = indexOfFrame < parent.children.length - 1;
    if (!hasRightSiblings) {
      return null;
    }

    return parent.children[indexOfFrame + 1];
  }

  const hasLeftSiblings = indexOfFrame > 0;

  if (!hasLeftSiblings) {
    return null;
  }

  return parent.children[indexOfFrame + -1];
}
