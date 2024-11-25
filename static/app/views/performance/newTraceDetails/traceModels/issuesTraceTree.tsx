import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types/organization';
import {
  isCollapsedNode,
  isParentAutogroupedNode,
  isTraceErrorNode,
  isTransactionNode,
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
    issuesTree.root = tree.root;
    return issuesTree;
  }

  static CollapseNodes(root: TraceTreeNode) {
    // Collect all nodes with errors and their path to the root. None of these nodes should be collapsed
    // because we want to preserve the path to the error node so that the user can see the chain that lead
    // to it.
    const errorNodes = TraceTree.FindAll(
      root,
      node =>
        node.errors.size > 0 || node.performance_issues.size > 0 || isTraceErrorNode(node)
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

      const children = isParentAutogroupedNode(node) ? [node.head] : node.children;

      for (const child of children) {
        queue.push(child);
      }

      let index = 0;
      while (index < children.length) {
        const start = index;

        while (children[index] && !preserveNodes.has(children[index])) {
          index++;
        }

        if (index - start > 0) {
          const collapsedNode = new CollapsedNode(
            node,
            {type: 'collapsed'},
            node.metadata
          );

          collapsedNode.children = children.splice(start, index - start, collapsedNode);

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

  static ExpandToEvent(
    tree: IssuesTraceTree,
    eventId: string,
    options: {
      api: Client;
      organization: Organization;
      preferences: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
    }
  ): Promise<void> {
    const node = TraceTree.Find(tree.root, n => {
      if (isTraceErrorNode(n)) {
        return n.value.event_id === eventId;
      }
      if (isTransactionNode(n)) {
        if (n.value.event_id === eventId) {
          return true;
        }

        for (const e of n.errors) {
          if (e.event_id === eventId) {
            return true;
          }
        }

        for (const p of n.performance_issues) {
          if (p.event_id === eventId) {
            return true;
          }
        }
      }
      return false;
    });

    if (node && isTransactionNode(node)) {
      return tree.zoom(node, true, options).then(() => {});
    }

    return Promise.resolve();
  }

  build() {
    super.build();

    for (let i = 0; i < this.list.length; i++) {
      if (
        this.list[i].errors.size === 0 &&
        this.list[i].performance_issues.size === 0 &&
        !isTraceErrorNode(this.list[i])
      ) {
        const start = i;
        while (
          i < this.list.length &&
          !this.list[i].errors.size &&
          !this.list[i].performance_issues.size &&
          !isTraceErrorNode(this.list[i])
        ) {
          i++;
        }

        if (i - start > 0) {
          const newNode = new CollapsedNode(
            this.list[start].parent!,
            {type: 'collapsed'},
            this.list[start].metadata
          );

          const removed = this.list.splice(start, i - start, newNode);
          newNode.children = [removed[0]];
        }
      }
    }

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
        newNode.children = removed;
      }
    }

    return this;
  }
}
