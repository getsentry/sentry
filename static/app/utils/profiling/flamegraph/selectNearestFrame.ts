import {FlamegraphFrame} from '../flamegraphFrame';

export type DirectionX = 'left' | 'right';
export type DirectionY = 'up' | 'down';
export type Direction = DirectionY | DirectionX;
/**
 * selectNearestFrame walks a FlamegraphFrame tree the direction specified and returns the nearest
 * FlamegraphFrame relative to the starting node.
 */
export function selectNearestFrame(frame: FlamegraphFrame, direction: Direction) {
  if (direction === 'up') {
    const parent = frame.parent;
    // if there is an immediate parent, goto parent
    if (parent) {
      return parent;
    }

    // if there is no parent, we attempt to move left to the next stack
    const leftSibling = getSibling(frame, 'left');
    if (leftSibling) {
      return leftSibling;
    }

    return frame;
  }

  if (direction === 'down') {
    // if there is an immediate child, goto child
    const child = frame.children?.[0];
    if (child) {
      return child;
    }

    // if there is no child, we attempt to move right to the next stack
    const sibling = scanForNearestSibling(frame, 'right');
    if (sibling) {
      return sibling;
    }

    return frame;
  }

  // scan for the nearest sibling in either the left or right direction
  // this function will walk us up the tree to a new branch
  const sibling = scanForNearestSibling(frame, direction);

  // if we find an adjacent sibling we attempt to walk down to a depth that
  // matches our targetDepth
  if (sibling) {
    const targetDepth = frame.depth;
    const nodeWithDepth = scanForNearestFrameWithDepth(sibling, targetDepth, direction);
    if (nodeWithDepth) {
      return nodeWithDepth;
    }
  }

  return frame;
}

/**
 * scanForNearestSibling will walk up a branch looking for an adjacent sibling
 */
function scanForNearestSibling(frame: FlamegraphFrame, directionX: DirectionX) {
  let node = frame;
  while (node) {
    const sibling = getSibling(node, directionX);

    if (sibling) {
      return sibling;
    }

    if (!node.parent) {
      break;
    }

    node = node.parent;
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

  // get the index of the current frame relative to its siblings
  const indexOfFrame = parent.children.indexOf(frame);
  // this should never happen, it would make our data structure invalid
  if (indexOfFrame === -1) {
    throw Error('frame.parent.children does not include current frame');
  }

  if (directionX === 'right') {
    const hasRightSiblings = indexOfFrame < parent.children.length - 1;
    if (hasRightSiblings) {
      return parent.children[indexOfFrame + 1];
    }
    return null;
  }

  const hasLeftSiblings = indexOfFrame > 0;
  if (hasLeftSiblings) {
    return parent.children[indexOfFrame - 1];
  }

  return null;
}
