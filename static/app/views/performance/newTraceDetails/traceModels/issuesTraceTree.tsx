import type {Client} from 'sentry/api';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {
  isEAPErrorNode,
  isEAPSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {CollapsedNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceCollapsedNode';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TracePreferencesState} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import type {HydratedReplayRecord} from 'sentry/views/replays/types';

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
      replay: HydratedReplayRecord | null;
      preferences?: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
    }
  ): IssuesTraceTree {
    const tree = super.FromTrace(trace, options);
    const issuesTree = new IssuesTraceTree();
    issuesTree.root = tree.root;
    return issuesTree;
  }

  static ExpandToEvent(
    tree: IssuesTraceTree,
    event: Event,
    options: {
      api: Client;
      organization: Organization;
      preferences: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
    }
  ): Promise<void> {
    const node = TraceTree.Find(tree.root, n => {
      if (isTraceErrorNode(n) || isEAPErrorNode(n)) {
        return n.value.event_id === event.eventID;
      }
      if (isTransactionNode(n) || isEAPSpanNode(n)) {
        if (n.value.event_id === event.eventID) {
          return true;
        }

        for (const e of n.errors) {
          if (e.event_id === event.eventID) {
            return true;
          }
        }

        for (const o of n.occurrences) {
          if (isTransactionNode(n)) {
            if (o.event_id === event.eventID) {
              return true;
            }
          } else if (o.event_id === event.occurrence?.id) {
            return true;
          }
        }
      }
      return false;
    });

    if (node) {
      if (isTransactionNode(node)) {
        return tree.zoom(node, true, options).then(() => {});
      }

      if (isEAPSpanNode(node)) {
        tree.expand(node, true);
      }
    }

    return Promise.resolve();
  }

  /**
   * Collapse the list of nodes to only include the preserveLeafNodes and the surrounding nodes.
   * @param preserveLeafNodes - The nodes to preserve.
   * @param numSurroundingNodes - The number of surrounding nodes to preserve.
   */
  collapseList(
    preserveLeafNodes: TraceTreeNode[],
    numSurroundingNodes: number,
    minShownNodes: number
  ) {
    // Create set of nodes to preserve from input parameters
    const preserveNodes = new Set(preserveLeafNodes);

    for (const node of preserveLeafNodes) {
      const parentTransaction = isEAPSpanNode(node)
        ? TraceTree.ParentEAPTransaction(node)
        : TraceTree.ParentTransaction(node);
      if (parentTransaction) {
        preserveNodes.add(parentTransaction);
      }
    }

    for (const node of preserveLeafNodes) {
      const index = this.list.indexOf(node);
      if (index === -1) {
        continue;
      }

      // Preserve the previous n nodes
      let i = Math.max(index - 1, 0);
      while (i > index - numSurroundingNodes) {
        if (this.list[i]) {
          preserveNodes.add(this.list[i]!);
        }
        i--;
      }

      // Preserve the next n nodes
      let j = Math.min(index + 1, this.list.length - 1);
      while (j < index + numSurroundingNodes) {
        if (this.list[j]) {
          preserveNodes.add(this.list[j]!);
        }
        j++;
      }
    }

    // Preserve a minimum number of nodes so it doesn't feel overly sparse
    if (preserveNodes.size < minShownNodes && this.list.length > 0) {
      let additionalNodesNeeded = minShownNodes - preserveNodes.size;
      // Start from the root of the issue and go down the list
      let index = Math.max(0, this.list.indexOf(preserveLeafNodes[0]!));

      while (additionalNodesNeeded > 0 && index < this.list.length) {
        if (!preserveNodes.has(this.list[index]!)) {
          preserveNodes.add(this.list[index]!);
          additionalNodesNeeded--;
        }
        index++;
      }
    }

    let i = 0;
    while (i < this.list.length) {
      const start = i;
      while (this.list[i] && !preserveNodes.has(this.list[i]!)) {
        i++;
      }

      if (i - start > 0) {
        const collapsedNode = new CollapsedNode(
          this.list[start]!.parent!,
          {type: 'collapsed'},
          this.list[start]!.metadata
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
