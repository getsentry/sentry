import {
  isParentAutogroupedNode,
  isTraceErrorNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {ReplayRecord} from 'sentry/views/replays/types';

import type {TraceMetaQueryResults} from '../traceApi/useTraceMeta';
import {CollapsedNode} from '../traceModels/traceCollapsedNode';

import type {TraceTreeNode} from './traceTreeNode';

const MAX_ISSUES = 20;

export class IssuesTraceTree extends TraceTree {
  static FromTrace(
    trace: TraceTree.Trace,
    options: {
      meta: TraceMetaQueryResults['data'] | null;
      replay: ReplayRecord | null;
    }
  ): IssuesTraceTree {
    const tree = TraceTree.FromTrace(trace, options);
    const issuesTree = new IssuesTraceTree();

    // Collect all nodes with errors and their path to the root. None of these nodes should be collapsed
    // because we want to preserve the path to the error node so that the user can see the chain that lead
    // to it.
    const errorNodes = TraceTree.FindAll(
      tree.root,
      node => node.hasErrors || isTraceErrorNode(node)
    ).slice(0, MAX_ISSUES);

    const preserveNodes = new Set<TraceTreeNode>();
    for (const node of errorNodes) {
      let current: TraceTreeNode | null = node;
      while (current) {
        preserveNodes.add(current);
        current = current.parent;
      }
    }

    const queue: TraceTreeNode[] = [tree.root];

    while (queue.length > 0) {
      const node = queue.pop();

      if (!node) {
        continue;
      }

      for (const child of node.children) {
        queue.push(child);
      }

      let index = 0;
      while (index < node.children.length) {
        const start = index;

        while (node.children[index] && !preserveNodes.has(node.children[index])) {
          index++;
        }

        if (index - start > 0) {
          const collapsedNode = new CollapsedNode(
            node,
            {type: 'collapsed'},
            node.metadata
          );

          collapsedNode.children = node.children.splice(
            start,
            index - start,
            collapsedNode
          );

          for (const child of collapsedNode.children) {
            child.parent = collapsedNode;
          }

          // Skip the section we collapsed so we dont collapse or process it again
          index = start + 1;
        } else {
          index++;
        }
      }
    }

    issuesTree.root = tree.root;
    return issuesTree;
  }

  build() {
    const queue: TraceTreeNode<TraceTree.NodeValue>[] = [];
    const visibleChildren: TraceTreeNode<TraceTree.NodeValue>[] = [];

    if (this.root.expanded || isParentAutogroupedNode(this.root)) {
      const children = TraceTree.DirectVisibleChildren(this.root);

      for (let i = children.length - 1; i >= 0; i--) {
        queue.push(children[i]);
      }
    }

    while (queue.length > 0) {
      const node = queue.pop()!;

      visibleChildren.push(node);

      // iterate in reverse to ensure nodes are processed in order
      if (node.expanded || isParentAutogroupedNode(node)) {
        const children = TraceTree.DirectVisibleChildren(node);

        for (let i = children.length - 1; i >= 0; i--) {
          queue.push(children[i]);
        }
      }
    }

    this.list = visibleChildren;
    return this;
  }
}
