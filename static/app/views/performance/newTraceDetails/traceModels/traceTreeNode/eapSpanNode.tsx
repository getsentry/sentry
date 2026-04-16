import type {Theme} from '@emotion/react';

import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {t} from 'sentry/locale';
import type {Measurement} from 'sentry/types/event';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {isBrowserRequestNode} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {EAPSpanNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {isEAPSpanNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceEAPSpanRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceEAPSpanRow';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';
import {traceChronologicalSort} from './utils';

export class EapSpanNode extends BaseNode<TraceTree.EAPSpan> {
  id: string;
  type: TraceTree.NodeType;

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

    this.id = value.event_id;
    this.type = 'span';
    this.traceItemDataset = TraceItemDataset.SPANS;

    this.searchPriority = this.value.is_transaction ? 1 : 2;
    this.isEAPEvent = true;
    this.expanded = !value.is_transaction;
    this.canAutogroup = !value.is_transaction;
    this.allowNoInstrumentationNodes = !value.is_transaction;

    const closestEAPTransaction = this.findParentEapTransaction();
    if (!value.is_transaction && closestEAPTransaction) {
      // Propagate errors to the closest EAP transaction for visibility in the initially collapsed
      // eap-transactions only view, on load
      for (const error of value.errors) {
        closestEAPTransaction.errors.add(error);
      }

      // Propagate occurrences to the closest EAP transaction for visibility in the initially collapsed
      // eap-transactions only view, on load
      for (const occurrence of value.occurrences) {
        closestEAPTransaction.occurrences.add(occurrence);
      }
    }

    this._updateAncestorOpsBreakdown(this, value.op);

    parent?.children.push(this);
    parent?.children.sort(traceChronologicalSort);
  }

  private _updateAncestorOpsBreakdown(node: EapSpanNode, op: string) {
    let current = node.parent;
    while (current) {
      if (isEAPSpanNode(current)) {
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

  /**
   * Build the summarized child list for a collapsed EAP transaction.
   *
   * In the collapsed state we do not render the full span tree. Instead, we surface the
   * first descendant EAP transaction reachable on each branch so the user still sees
   * embedded transactions without expanding all intermediary spans.
   *
   * This traversal intentionally preserves real parentage. Nested transactions stay attached
   * to their actual span parents and are only surfaced as visible descendants in the collapsed
   * summary; we do not reparent them under the collapsed transaction node.
   *
   * We also have to traverse through non-EAP wrapper nodes via `getNextTraversalNodes()`.
   * After `ApplyPreferences` runs, wrappers like `ParentAutogroupNode` can sit between this
   * transaction and a nested descendant transaction. If we stopped at `!isEAPSpanNode(node)`,
   * those descendant transactions would disappear from the collapsed summary.
   */
  private getCollapsedTransactionChildren(): BaseNode[] {
    const queue: BaseNode[] = [];
    const collapsedChildren: BaseNode[] = [];
    const visited = new Set<BaseNode>();
    visited.add(this);

    for (let i = this.children.length - 1; i >= 0; i--) {
      queue.push(this.children[i]!);
    }

    while (queue.length > 0) {
      const node = queue.pop()!;

      if (visited.has(node)) {
        continue;
      }
      visited.add(node);

      if (isEAPSpanNode(node) && node.value.is_transaction) {
        collapsedChildren.push(node);
        continue;
      }

      const nextNodes = node.getNextTraversalNodes();
      for (let i = nextNodes.length - 1; i >= 0; i--) {
        queue.push(nextNodes[i]!);
      }
    }

    return collapsedChildren.sort(traceChronologicalSort);
  }

  get drawerTabsTitle(): string {
    return this.op + (this.description ? ' - ' + this.description : '');
  }

  get measurements(): Record<string, Measurement> | undefined {
    if (!this.value.measurements) {
      return undefined;
    }

    const result: Record<string, Measurement> = {};
    for (const key in this.value.measurements) {
      const value = this.value.measurements[key];
      if (typeof value === 'number') {
        const normalizedKey = key.replace('measurements.', '');
        result[normalizedKey] = {value};
      }
    }
    return result;
  }

  get profileId(): string | undefined {
    const profileId = super.profileId;

    if (profileId) {
      return profileId;
    }

    return this.value.is_transaction
      ? undefined
      : this.findClosestParentTransaction()?.profileId;
  }

  get profilerId(): string | undefined {
    const profilerId = super.profilerId;

    if (profilerId) {
      return profilerId;
    }

    return this.value.is_transaction
      ? undefined
      : this.findClosestParentTransaction()?.profilerId;
  }

  get transactionId(): string | undefined {
    // If the node represents a transaction, we use the transaction_id attached to the node,
    // otherwise we use the transaction_id of the closest parent transaction.
    return this.value.is_transaction
      ? this.value.transaction_id
      : this.findClosestParentTransaction()?.transactionId;
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

  get directVisibleChildren(): Array<BaseNode<TraceTree.NodeValue>> {
    if (this.value.is_transaction && !this.expanded) {
      // For collapsed eap-transactions we render the first nested transaction on each
      // descendant branch while preserving the actual tree parentage.
      return this.getCollapsedTransactionChildren();
    }

    return super.directVisibleChildren;
  }

  private _reparentSSRUnderBrowserRequestSpan(node: BaseNode) {
    const serverRequestHandler = node.parent?.children.find(n => n.op === 'http.server');

    if (serverRequestHandler?.reparent_reason === 'pageload server handler') {
      serverRequestHandler.parent!.children =
        serverRequestHandler.parent!.children.filter(n => n !== serverRequestHandler);
      node.children.push(serverRequestHandler);
      serverRequestHandler.parent = node;
    }
  }

  expand(expanding: boolean, tree: TraceTree): boolean {
    const index = tree.list.indexOf(this);

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

      if (this.value.is_transaction) {
        const browserRequestSpan = this.children.find(c => isBrowserRequestNode(c));
        if (browserRequestSpan) {
          this._reparentSSRUnderBrowserRequestSpan(browserRequestSpan);
        }
      }

      // Insert expanded children into the flat list
      tree.list.splice(index + 1, 0, ...this.visibleChildren);
    } else {
      tree.list.splice(index + 1, this.visibleChildren.length);

      this.expanded = expanding;

      // When transaction nodes are collapsed, they still render child transactions
      if (this.value.is_transaction) {
        tree.list.splice(index + 1, 0, ...this.visibleChildren);
      }
    }

    this.invalidate();
    this.forEachChild(child => child.invalidate());
    return true;
  }

  makeBarColor(theme: Theme): string {
    return pickBarColor(this.op, theme);
  }

  analyticsName(): string {
    return 'eap span';
  }

  printNode(): string {
    return (
      (this.op || 'unknown span') +
      ' - ' +
      (this.description || 'unknown description') +
      (this.value.is_transaction ? ' (eap-transaction)' : '')
    );
  }

  renderWaterfallRow<T extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<T>
  ): React.ReactNode {
    return <TraceEAPSpanRow {...props} node={this} />;
  }

  renderDetails<T extends BaseNode>(
    props: TraceTreeNodeDetailsProps<T>
  ): React.ReactNode {
    return <EAPSpanNodeDetails {...props} node={this} />;
  }

  matchWithFreeText(query: string): boolean {
    return (
      this.op?.includes(query) ||
      this.description?.includes(query) ||
      this.value.name?.includes(query) ||
      this.id === query
    );
  }

  matchById(id: string): boolean {
    const superMatch = super.matchById(id);

    // Match by transaction_id if the node represents a transaction, otherwise use the super match.
    return superMatch || (this.value.is_transaction ? id === this.transactionId : false);
  }

  resolveValueFromSearchKey(key: string): any | null {
    // @TODO Abdullah Khan: Add EAPSpanNode support for exclusive_time
    if (['duration', 'span.duration', 'span.total_time'].includes(key)) {
      return this.space[1];
    }

    // @TODO perf optimization opportunity
    // Entity check should be preprocessed per token, not once per token per node we are evaluating, however since
    // we are searching <10k nodes in p99 percent of the time and the search is non blocking, we are likely fine
    // and can be optimized later.
    const [maybeEntity, ...rest] = key.split('.');
    if (maybeEntity === 'span') {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return this.value[rest.join('.')];
    }

    return null;
  }
}
