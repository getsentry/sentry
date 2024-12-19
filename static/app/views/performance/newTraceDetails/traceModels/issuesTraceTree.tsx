import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types/organization';
import {
  isTraceErrorNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TracePreferencesState} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import type {ReplayRecord} from 'sentry/views/replays/types';

import type {TraceMetaQueryResults} from '../traceApi/useTraceMeta';
import {CollapsedNode} from '../traceModels/traceCollapsedNode';

import {makeExampleTrace} from './makeExampleTrace';
import type {TraceTreeNode} from './traceTreeNode';

export class IssuesTraceTree extends TraceTree {
  static Empty() {
    const tree = new IssuesTraceTree().build();
    tree.type = 'empty';
    return tree;
  }

  static Loading(metadata: TraceTree.Metadata): IssuesTraceTree {
    const t = makeExampleTrace(metadata);
    const tree = new IssuesTraceTree();
    tree.root = t.root;
    tree.type = 'loading';
    tree.build();
    return tree;
  }

  static Error(metadata: TraceTree.Metadata): IssuesTraceTree {
    const t = makeExampleTrace(metadata);
    const tree = new IssuesTraceTree();
    tree.root = t.root;
    tree.type = 'error';
    tree.build();
    return tree;
  }

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

  collapseList(preserveLeafNodes: TraceTreeNode[]) {
    const preserveNodes = new Set(preserveLeafNodes);

    for (const node of preserveLeafNodes) {
      const parentTransaction = TraceTree.ParentTransaction(node);
      if (parentTransaction) {
        preserveNodes.add(parentTransaction);
      }
    }

    for (const node of preserveLeafNodes) {
      const index = this.list.indexOf(node);
      if (index === -1) {
        continue;
      }

      // Preserve the previous 2 nodes
      let i = Math.max(index - 1, 0);
      while (i > index - 3) {
        if (this.list[i]) {
          preserveNodes.add(this.list[i]);
        }
        i--;
      }

      // Preserve the next 2 nodes
      let j = Math.min(index + 1, this.list.length - 1);
      while (j < index + 3) {
        if (this.list[j]) {
          preserveNodes.add(this.list[j]);
        }
        j++;
      }
    }

    let i = 0;
    while (i < this.list.length) {
      const start = i;
      while (this.list[i] && !preserveNodes.has(this.list[i])) {
        i++;
      }

      if (i - start > 0) {
        const collapsedNode = new CollapsedNode(
          this.list[start].parent!,
          {type: 'collapsed'},
          this.list[start].metadata
        );

        const removed = this.list.splice(start, i - start, collapsedNode);
        collapsedNode.children = removed;

        i = start + 1;
        continue;
      }

      i++;
    }

    return this;
  }

  build() {
    super.build();
    return this;
  }
}
