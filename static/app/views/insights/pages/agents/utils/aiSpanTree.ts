import type {AITraceSpanNode} from './types';

/**
 * A row of the AI span timeline, nested under the closest ancestor span that is
 * part of the timeline.
 *
 * Mirrors the trace waterfall's `BaseNode` (`parent`, `children`, `depth`) and its
 * traversal helpers in `traceTreeTraversal.ts`, but never touches the trace
 * tree's nodes: the Agent Activity tab shares them with the waterfall, and the
 * conversation view builds its nodes from a flat span list.
 */
export interface AiSpanTreeNode {
  children: AiSpanTreeNode[];
  depth: number;
  node: AITraceSpanNode;
  parent: AiSpanTreeNode | null;
}

export interface AiSpanTree {
  byId: Map<string, AiSpanTreeNode>;
  /**
   * Every tree node, depth-first: each node is followed by its descendants.
   */
  list: AiSpanTreeNode[];
  roots: AiSpanTreeNode[];
}

/**
 * Nests the AI spans under their closest ancestor that is one of `nodes`, skipping
 * the spans in between (HTTP calls, spans outside the conversation, ...).
 *
 * Siblings keep their order in `nodes` unless `compareSiblings` is given.
 */
export function buildAiSpanTree(
  nodes: AITraceSpanNode[],
  {
    compareSiblings,
  }: {compareSiblings?: (a: AITraceSpanNode, b: AITraceSpanNode) => number} = {}
): AiSpanTree {
  const byId = new Map<string, AiSpanTreeNode>();
  for (const node of nodes) {
    if (!byId.has(node.id)) {
      byId.set(node.id, {node, parent: null, children: [], depth: 0});
    }
  }

  const treeNodes = [...byId.values()];
  for (const treeNode of treeNodes) {
    treeNode.parent = findClosestTreeAncestor(treeNode.node, byId);
  }
  breakParentCycles(treeNodes);

  const roots: AiSpanTreeNode[] = [];
  for (const treeNode of treeNodes) {
    if (treeNode.parent) {
      treeNode.parent.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  if (compareSiblings) {
    const compare = (a: AiSpanTreeNode, b: AiSpanTreeNode) =>
      compareSiblings(a.node, b.node);
    roots.sort(compare);
    for (const treeNode of treeNodes) {
      treeNode.children.sort(compare);
    }
  }

  const list: AiSpanTreeNode[] = [];
  const stack = roots.toReversed();
  while (stack.length > 0) {
    const treeNode = stack.pop()!;
    treeNode.depth = treeNode.parent ? treeNode.parent.depth + 1 : 0;
    list.push(treeNode);
    for (let i = treeNode.children.length - 1; i >= 0; i--) {
      stack.push(treeNode.children[i]!);
    }
  }

  return {byId, list, roots};
}

/**
 * The tree nodes on screen when only the nodes that `isExpanded` accepts show
 * their children. The counterpart of `BaseNode.visibleChildren`.
 */
export function getVisibleTreeNodes(
  tree: AiSpanTree,
  isExpanded: (treeNode: AiSpanTreeNode) => boolean
): AiSpanTreeNode[] {
  const visible: AiSpanTreeNode[] = [];
  const stack = tree.roots.toReversed();
  while (stack.length > 0) {
    const treeNode = stack.pop()!;
    visible.push(treeNode);
    if (treeNode.children.length > 0 && isExpanded(treeNode)) {
      for (let i = treeNode.children.length - 1; i >= 0; i--) {
        stack.push(treeNode.children[i]!);
      }
    }
  }
  return visible;
}

/**
 * Like `StructuredEventData`'s `maxDefaultDepth`: nodes shallower than
 * `maxDefaultDepth` start expanded.
 */
export function isExpandedByDefault(
  treeNode: AiSpanTreeNode,
  maxDefaultDepth: number
): boolean {
  return treeNode.depth < maxDefaultDepth;
}

/**
 * The tree node's ancestors, closest first. Expanding them reveals the node, like
 * the waterfall's `TraceTree.ExpandToPath`.
 */
export function getTreeAncestors(treeNode: AiSpanTreeNode): AiSpanTreeNode[] {
  const ancestors: AiSpanTreeNode[] = [];
  let parent = treeNode.parent;
  while (parent) {
    ancestors.push(parent);
    parent = parent.parent;
  }
  return ancestors;
}

/**
 * The tree node's descendants, depth-first.
 */
export function getTreeDescendants(treeNode: AiSpanTreeNode): AiSpanTreeNode[] {
  const descendants: AiSpanTreeNode[] = [];
  const stack = treeNode.children.toReversed();
  while (stack.length > 0) {
    const descendant = stack.pop()!;
    descendants.push(descendant);
    for (let i = descendant.children.length - 1; i >= 0; i--) {
      stack.push(descendant.children[i]!);
    }
  }
  return descendants;
}

function findClosestTreeAncestor(
  node: AITraceSpanNode,
  byId: Map<string, AiSpanTreeNode>
): AiSpanTreeNode | null {
  let isCycle = false;
  const visited = new Set<unknown>([node]);
  const ancestor = node.findParent(parent => {
    // Parent links can loop; stop the walk there.
    if (visited.has(parent)) {
      isCycle = true;
      return true;
    }
    visited.add(parent);
    return byId.has(parent.id);
  });
  if (isCycle || !ancestor || ancestor.id === node.id) {
    return null;
  }
  return byId.get(ancestor.id) ?? null;
}

/**
 * Parent links that loop would leave the looping nodes unreachable from any
 * root. Turn one node of each loop into a root so every node stays in the tree.
 */
function breakParentCycles(treeNodes: AiSpanTreeNode[]) {
  const settled = new Set<AiSpanTreeNode>();
  for (const treeNode of treeNodes) {
    const path = new Set<AiSpanTreeNode>();
    let current: AiSpanTreeNode | null = treeNode;
    while (current && !settled.has(current)) {
      if (path.has(current)) {
        current.parent = null;
        break;
      }
      path.add(current);
      current = current.parent;
    }
    for (const visited of path) {
      settled.add(visited);
    }
  }
}
