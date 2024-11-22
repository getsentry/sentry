import type {Client} from 'sentry/api';
import type {Event, EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {
  isCollapsedNode,
  isTraceErrorNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TracePreferencesState} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import type {ReplayRecord} from 'sentry/views/replays/types';

import type {TraceMetaQueryResults} from '../traceApi/useTraceMeta';
import {CollapsedNode} from '../traceModels/traceCollapsedNode';

import type {TraceTreeNode} from './traceTreeNode';

const MAX_ISSUES = 10;

export class IssuesTraceTree extends TraceTree {
  static FromTrace(
    trace: TraceTree.Trace,
    options: {
      meta: TraceMetaQueryResults['data'] | null;
      replay: ReplayRecord | null;
    }
  ): IssuesTraceTree {
    const tree = super.FromTrace(trace, options);
    const issuesTree = new IssuesTraceTree();
    IssuesTraceTree.CollapseNodes(tree.root);
    issuesTree.root = tree.root;
    return issuesTree;
  }

  static FromSpans(
    node: TraceTreeNode<TraceTree.NodeValue>,
    spans: TraceTree.Span[],
    event: EventTransaction | null
  ): [TraceTreeNode<TraceTree.NodeValue>, [number, number]] {
    const [root, space] = super.FromSpans(node, spans, event);
    IssuesTraceTree.CollapseNodes(root);
    return [root, space];
  }

  async zoom(
    node: TraceTreeNode<TraceTree.NodeValue>,
    zoomedIn: boolean,
    options: {
      api: Client;
      organization: Organization;
      preferences: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
    }
  ): Promise<Event | null> {
    const result = await super.zoom(node, zoomedIn, options);
    IssuesTraceTree.CollapseNodes(this.root);
    return result;
  }

  static CollapseNodes(root: TraceTreeNode) {
    // Collect all nodes with errors and their path to the root. None of these nodes should be collapsed
    // because we want to preserve the path to the error node so that the user can see the chain that lead
    // to it.
    const errorNodes = TraceTree.FindAll(
      root,
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

    const queue: TraceTreeNode[] = [root];

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
  }

  build() {
    super.build();

    // Since we only collapsed sibling nodes, it means that it is possible for the list to contain
    // sibling collapsed nodes. We'll do a second pass to flatten these nodes and replace them with
    // a single fake collapsed node.
    for (let i = 0; i < this.list.length; i++) {
      if (!isCollapsedNode(this.list[i])) {
        continue;
      }

      const start = i;
      while (i < this.list.length && isCollapsedNode(this.list[i])) {
        i++;
      }

      if (i - start > 0) {
        const newNode = new CollapsedNode(
          this.list[start].parent!,
          {type: 'collapsed'},
          this.list[start].metadata
        );

        const removed = this.list.splice(start, i - start, newNode);

        for (const node of removed) {
          newNode.children = newNode.children.concat(node.children);
        }
      }
    }

    return this;
  }
}
