import type {Client} from 'sentry/api';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TracePreferencesState} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import type {HydratedReplayRecord} from 'sentry/views/replays/types';

import type {BaseNode} from './traceTreeNode/baseNode';
import {CollapsedNode} from './traceTreeNode/collapsedNode';
import {makeExampleTrace} from './makeExampleTrace';

export class IssuesTraceTree extends TraceTree {
  static Empty() {
    const tree = new IssuesTraceTree().build();
    tree.type = 'empty';
    return tree;
  }

  static Loading(
    metadata: TraceTree.Metadata,
    organization: Organization
  ): IssuesTraceTree {
    const t = makeExampleTrace(metadata, organization);
    const tree = new IssuesTraceTree();
    tree.root = t.root;
    tree.type = 'loading';
    tree.build();
    return tree;
  }

  static Error(
    metadata: TraceTree.Metadata,
    organization: Organization
  ): IssuesTraceTree {
    const t = makeExampleTrace(metadata, organization);
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
      organization: Organization;
      replay: HydratedReplayRecord | null;
      preferences?: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
    }
  ): IssuesTraceTree {
    const baseTree = super.FromTrace(trace, options);
    const issuesTree = new IssuesTraceTree();

    Object.assign(issuesTree, baseTree);

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
    const node = tree.root.findChild(n => {
      return n.matchById(event.eventID);
    });

    if (node) {
      if (node.canFetchChildren) {
        return node.fetchChildren(true, tree, options).then(() => {});
      }
      node.expand(true, tree);
    }

    return Promise.resolve();
  }

  /**
   * Collapse the list of nodes to only include the preserveLeafNodes and the surrounding nodes.
   * @param preserveLeafNodes - The nodes to preserve.
   * @param numSurroundingNodes - The number of surrounding nodes to preserve.
   */
  collapseList(
    preserveLeafNodes: BaseNode[],
    numSurroundingNodes: number,
    minShownNodes: number
  ) {
    // Create set of nodes to preserve from input parameters
    const preserveNodes = new Set(preserveLeafNodes);

    for (const node of preserveLeafNodes) {
      const parentTransaction = node.findClosestParentTransaction();
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
          null
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
