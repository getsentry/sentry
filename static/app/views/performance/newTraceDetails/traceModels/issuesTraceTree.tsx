import {isTraceErrorNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {ReplayRecord} from 'sentry/views/replays/types';

import type {TraceMetaQueryResults} from '../traceApi/useTraceMeta';
import {CollapsedNode} from '../traceModels/traceCollapsedNode';

import type {TraceTreeNode} from './traceTreeNode';

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
    );

    const preservePaths = new Set<TraceTreeNode>();
    for (const node of errorNodes) {
      let current: TraceTreeNode | null = node;
      while (current) {
        preservePaths.add(current);
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

        while (
          node.children[index] &&
          !node.children[index]?.hasErrors &&
          !preservePaths.has(node.children[index])
        ) {
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
    super.build();
    return this;
  }
}
