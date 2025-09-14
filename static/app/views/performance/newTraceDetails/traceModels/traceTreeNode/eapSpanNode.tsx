import {t} from 'sentry/locale';
import {SpanNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {
  isEAPSpan,
  isEAPTransaction,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';
import {TraceSpanRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceSpanRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';
import {traceChronologicalSort} from './utils';

export class EapSpanNode extends BaseNode<TraceTree.EAPSpan> {
  /**
   * The breakdown of the node's children's operations by count.
   */
  opsBreakdown: TraceTree.OpsBreakdown = [];

  constructor(
    parent: BaseNode | null,
    value: TraceTree.EAPSpan,
    extra: TraceTreeNodeExtra
  ) {
    super(parent, value, extra);

    if (value.is_transaction) {
      const closestEAPTransaction = TraceTree.ParentEAPTransaction(this as any);
      this.parent = (closestEAPTransaction as any) ?? parent;
    }

    if (!value.is_transaction) {
      if (this.parent) {
        // Propagate errors to the closest EAP transaction for visibility in the initially collapsed
        // eap-transactions only view, on load
        for (const error of value.errors) {
          this.parent.errors.add(error);
        }

        // Propagate occurrences to the closest EAP transaction for visibility in the initially collapsed
        // eap-transactions only view, on load
        for (const occurrence of value.occurrences) {
          this.parent.occurrences.add(occurrence);
        }
      }
    }

    this.expanded = !value.is_transaction;
    this.canAutogroup = !value.is_transaction;
    this.allowNoInstrumentationNodes = !value.is_transaction;

    this._updateAncestorOpsBreakdown(this, value.op);
  }

  private _updateAncestorOpsBreakdown(node: EapSpanNode, op: string) {
    let current = node.parent;
    while (current) {
      // TODO: Replace with isEAPSpanNode guard once we have it accept BaseNode
      if (current instanceof EapSpanNode) {
        const existing = current.opsBreakdown.find(b => b.op === op);
        if (existing) {
          existing.count++;
        } else {
          current.opsBreakdown.push({op, count: 1});
        }
      }
      current = current.parent;
    }
  }

  get drawerTabsTitle(): string {
    return this.op + (this.description ? ' - ' + this.description : '');
  }

  get traceHeaderTitle(): {
    title: string;
    subtitle?: string;
  } {
    return {
      title: this.op || t('Trace'),
      subtitle: this.value.transaction,
    };
  }

  get directChildren(): Array<BaseNode<TraceTree.NodeValue>> {
    if (isEAPTransaction(this.value)) {
      if (!this.expanded) {
        // For collapsed eap-transactions we still render the embedded eap-transactions as visible children.
        // Mimics the behavior of non-eap traces, enabling a less noisy/summarized view of the trace
        return this.children.filter(child => isEAPTransaction(child.value));
      }

      return this.children;
    }

    return this.children;
  }

  get visibleChildren(): Array<BaseNode<TraceTree.NodeValue>> {
    const queue: BaseNode[] = [];
    const visibleChildren: BaseNode[] = [];

    if (this.expanded || isEAPTransaction(this.value)) {
      const children = this.directChildren;

      for (let i = children.length - 1; i >= 0; i--) {
        queue.push(children[i]!);
      }
    }

    while (queue.length > 0) {
      const node = queue.pop()!;

      visibleChildren.push(node);

      // iterate in reverse to ensure nodes are processed in order
      if (node.expanded || isEAPTransaction(node.value)) {
        const children = node.directChildren;

        for (let i = children.length - 1; i >= 0; i--) {
          queue.push(children[i]!);
        }
      }
    }

    return visibleChildren;
  }

  private _reparentEAPTransactions(
    findEAPTransactions: (n: EapSpanNode) => EapSpanNode[],
    findNewParent: (t: EapSpanNode) => BaseNode | null
  ) {
    // Find all embedded eap-transactions, excluding the node itself
    const eapTransactions = findEAPTransactions(this);

    for (const trace of eapTransactions) {
      if (isEAPTransaction(trace.value)) {
        const newParent = findNewParent(trace);

        // If the transaction already has the correct parent, we can continue
        if (newParent === trace.parent) {
          continue;
        }

        // If we have found a new parent to reparent the transaction under,
        // remove it from its current parent's children and add it to the new parent
        if (newParent) {
          if (trace.parent) {
            trace.parent.children = trace.parent.children.filter(c => c !== trace);
          }
          newParent.children.push(trace);
          trace.parent = newParent;
          trace.parent.children.sort(traceChronologicalSort);
        }
      }
    }
  }

  private _reparentSSRUnderBrowserRequestSpan(node: EapSpanNode) {
    if (
      // Adjust for SDK changes in https://github.com/getsentry/sentry-javascript/pull/13527
      node.op === 'browser.request' ||
      (node.op === 'browser' && node.description === 'request')
    ) {
      const serverRequestHandler = node.parent?.children.find(
        n => isEAPSpan(n.value) && n.value.is_transaction && node.op === 'http.server'
      );

      if (serverRequestHandler?.reparent_reason === 'pageload server handler') {
        serverRequestHandler.parent!.children =
          serverRequestHandler.parent!.children.filter(n => n !== serverRequestHandler);
        node.children.push(serverRequestHandler);
        serverRequestHandler.parent = node;
      }
    }
  }

  expand(expanding: boolean, tree: TraceTree): boolean {
    const index = tree.list.indexOf(this as any);

    // Expanding is not allowed for zoomed in nodes
    if (expanding === this.expanded || this.hasFetchedChildren) {
      return false;
    }

    if (expanding) {
      if (this.value.is_transaction) {
        tree.list.splice(index + 1, this.visibleChildren.length);
      }

      // Flip expanded so that we can collect visible children
      this.expanded = expanding;

      // When eap-transaction nodes are expanded, we need to reparent the transactions under
      // the eap-spans (by their parent_span_id) that were previously hidden. Note that this only impacts the
      // direct eap-transaction children of the targetted eap-transaction node.
      if (this.value.is_transaction) {
        this._reparentEAPTransactions(
          trace => trace.children.filter(c => isEAPTransaction(c.value)) as EapSpanNode[],
          trace =>
            TraceTree.Find(this as any, n => {
              if (isEAPSpan(n.value)) {
                return n.value.event_id === trace.value.parent_span_id;
              }
              return false;
            }) as EapSpanNode | null
        );

        const browserRequestSpan = this.children.find(
          c => isEAPSpan(c.value) && c.value.is_transaction && this.op === 'http.server'
        ) as EapSpanNode | undefined;
        if (browserRequestSpan) {
          this._reparentSSRUnderBrowserRequestSpan(browserRequestSpan);
        }
      }

      // Flip expanded so that we can collect visible children
      tree.list.splice(index + 1, 0, ...(this.visibleChildren as any));
    } else {
      tree.list.splice(index + 1, this.visibleChildren.length);

      this.expanded = expanding;

      // When eap-transaction nodes are collapsed, they still render transactions as visible children.
      // Reparent the transactions from under the eap-spans in the expanded state, to under the closest eap-transaction
      // in the collapsed state. This only targets the embedded transactions that are to be direct children of the node upon collapse.
      if (this.value.is_transaction) {
        this._reparentEAPTransactions(
          trace =>
            TraceTree.FindAll(
              trace as any,
              n =>
                isEAPTransaction(n.value) &&
                n !== (trace as any) &&
                TraceTree.ParentEAPTransaction(n) === (this as any)
            ) as unknown as EapSpanNode[],
          trace => TraceTree.ParentEAPTransaction(trace as any) as EapSpanNode | null
        );
      }

      // When transaction nodes are collapsed, they still render child transactions
      if (this.value.is_transaction) {
        tree.list.splice(index + 1, 0, ...(this.visibleChildren as any));
      }
    }

    TraceTree.invalidate(this as any, true);
    return true;
  }

  pathToNode(): TraceTree.NodePath[] {
    return [`span-${this.id}`];
  }

  analyticsName(): string {
    return 'eap span';
  }

  printNode(): string {
    return this.op + (this.description ? ' - ' + this.description : '');
  }

  renderWaterfallRow<T extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<T>
  ): React.ReactNode {
    return (
      <TraceSpanRow {...props} node={props.node as TraceTreeNode<TraceTree.EAPSpan>} />
    );
  }

  renderDetails<T extends TraceTreeNode<TraceTree.NodeValue>>(
    props: TraceTreeNodeDetailsProps<T>
  ): React.ReactNode {
    return (
      <SpanNodeDetails {...props} node={props.node as TraceTreeNode<TraceTree.EAPSpan>} />
    );
  }

  matchWithFreeText(query: string): boolean {
    if (this.op?.includes(query)) {
      return true;
    }

    if (this.description?.includes(query)) {
      return true;
    }

    if (this.value.name?.includes(query)) {
      return true;
    }

    if (this.id === query) {
      return true;
    }

    return false;
  }
}
