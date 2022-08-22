import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

// Utility fn to filter a tree.
// The filtering is done in two steps - the first step marks nodes
// that should be kept in the tree. The second step iterates over all of the
// nodes that should be kept in the tree and finds their new parent nodes
// by walking up the node.parent reference chain and checking if the parent
// is in the set of nodes that should be kept.

// A tiny but important implementation details is that we only need to find every node's
// first new parent and not all of the parents. That is because we rely on insertion order
// of nodesToKeep (dfs). This effectively means that when a node is marked as kept, all of
// it's parent nodes have already been considered and exist in our new tree.
export function filterFlamegraphTree(
  roots: FlamegraphFrame[],
  skipFn: (frame: FlamegraphFrame) => boolean
): FlamegraphFrame[] {
  const stack: FlamegraphFrame[] = [];
  const nodesToKeep = new Map<FlamegraphFrame['frame']['key'], FlamegraphFrame>();

  // dfs to find nodes we want to keep.
  // Iteration order is important because we want to keep the order of the
  // original tree which allows us to rebuild it starting from the root.
  for (const root of roots) {
    stack.push(root);

    while (stack.length > 0) {
      const node = stack.pop();

      if (!node) {
        continue;
      }

      // If this is not a skippable node, add it to the set
      if (!skipFn(node)) {
        nodesToKeep.set(node.key, node);
      }

      // enqueue children
      for (let i = 0; i < node.children.length; i++) {
        stack.push(node.children[node.children.length - i - 1]);
      }
    }
  }

  // Rebuild the tree by iterating over the nodes we want to keep and
  // finding a new parent for each node.
  const tree: FlamegraphFrame[] = [];
  const nodes = new Map<FlamegraphFrame['frame']['key'], FlamegraphFrame>();
  for (const node of nodesToKeep.values()) {
    // We clear the children when we create a copy so we dont carry
    // over nodes that were not meant to be kept.
    const cpy = {...node, children: []};

    // Find the first parent that we are not supposed to skip
    let parent = node.parent;
    // While we have a parent and while that parent is not a node we want to keep
    while (parent) {
      if (nodesToKeep.has(parent.key)) {
        // We found a base, break
        break;
      }

      parent = parent.parent;
    }

    // Reassign parent. We can guarantee that parent is not null because
    // we are iterating over values in insertion order (maps guarantee this)
    cpy.parent = (parent ? nodes.get(parent.key) : null) || null;
    if (cpy.parent) {
      cpy.parent.children.push(cpy);
    } else {
      // If the frame's root does not exist or it may have
      // been filtered out, push the node to the roots
      tree.push(cpy);
    }

    // Set the new node in the map
    nodes.set(cpy.key, cpy);
  }

  return tree;
}
