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

  const list = walkDepthFirst(roots, treeNode => treeNode.children);
  // Parents come before their children, so their depth is already set.
  for (const treeNode of list) {
    treeNode.depth = treeNode.parent ? treeNode.parent.depth + 1 : 0;
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
  return walkDepthFirst(tree.roots, treeNode =>
    treeNode.children.length > 0 && isExpanded(treeNode) ? treeNode.children : []
  );
}

/**
 * Which nodes the timeline starts with expanded. Like `StructuredEventData`'s
 * `maxDefaultDepth`, nodes shallower than `maxDefaultDepth` start expanded. So do
 * the ancestors of `revealed`, the timeline's selected span, so it's visible.
 */
export function getDefaultExpanded(
  maxDefaultDepth: number,
  revealed?: AiSpanTreeNode
): (treeNode: AiSpanTreeNode) => boolean {
  const revealedAncestors = new Set(revealed ? getTreeAncestors(revealed) : []);
  return treeNode => revealedAncestors.has(treeNode) || treeNode.depth < maxDefaultDepth;
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
  return walkDepthFirst(treeNode.children, descendant => descendant.children);
}

/**
 * Lists `starts` and the nodes below them, each node followed by the nodes below
 * it. `getChildren` picks which children to descend into.
 */
function walkDepthFirst(
  starts: AiSpanTreeNode[],
  getChildren: (treeNode: AiSpanTreeNode) => AiSpanTreeNode[]
): AiSpanTreeNode[] {
  const visited: AiSpanTreeNode[] = [];
  const stack = starts.toReversed();
  for (let treeNode = stack.pop(); treeNode; treeNode = stack.pop()) {
    visited.push(treeNode);
    stack.push(...getChildren(treeNode).toReversed());
  }
  return visited;
}

// Both node kinds' `findParent` stop at looping parent links: trace tree nodes
// and the conversation view's nodes built from flat spans.
function findClosestTreeAncestor(
  node: AITraceSpanNode,
  byId: Map<string, AiSpanTreeNode>
): AiSpanTreeNode | null {
  const ancestor = node.findParent(parent => byId.has(parent.id));
  return ancestor ? (byId.get(ancestor.id) ?? null) : null;
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
