import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

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

  // A small disclaimer about the implementation:
  // Since we dont want to mutate the original tree, we need to create copies of the
  // nodes we want to keep and make sure we push new nodes to the copies instead of the original nodes.
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

    // console.log('Parent of', node.key, 'is', cpy.parent ? cpy.parent.key : null);
    if (cpy.parent) {
      cpy.parent.children.push(cpy);
    } else {
      // console.log('Pushing to all nodes');
      tree.push(cpy);
    }

    // Set the new node in the map
    nodes.set(cpy.key, cpy);
  }

  return tree;
}
