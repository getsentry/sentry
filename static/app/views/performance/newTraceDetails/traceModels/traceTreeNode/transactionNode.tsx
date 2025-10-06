/** @knipignore */

import type {Theme} from '@emotion/react';
import * as Sentry from '@sentry/react';

import type {Client} from 'sentry/api';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {getStylingSliceName} from 'sentry/views/explore/tables/tracesTable/utils';
import {TransactionNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {isTransactionNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';
import {TraceTransactionRow} from 'sentry/views/performance/newTraceDetails/traceRow/traceTransactionRow';
import type {TracePreferencesState} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';

import {BaseNode, type TraceTreeNodeExtra} from './baseNode';
import {traceChronologicalSort} from './utils';

const {info, fmt} = Sentry.logger;

export class TransactionNode extends BaseNode<TraceTree.Transaction> {
  private _spanPromises: Map<string, Promise<EventTransaction>> = new Map();
  private _fromSpans: typeof TraceTree.FromSpans;
  private _applyPreferences: typeof TraceTree.ApplyPreferences;

  extra: TraceTreeNodeExtra;

  searchPriority = 1;

  constructor(
    parent: BaseNode | null,
    value: TraceTree.Transaction,
    extra: TraceTreeNodeExtra,
    fromSpans: typeof TraceTree.FromSpans,
    applyPreferences: typeof TraceTree.ApplyPreferences
  ) {
    super(parent, value, extra);

    this.extra = extra;
    this._fromSpans = fromSpans;
    this._applyPreferences = applyPreferences;

    const spanChildrenCount = extra.meta?.transaction_child_count_map[this.id];

    // We check for >1 events, as the first one is the transaction node itself
    this.canFetchChildren =
      spanChildrenCount === undefined ? true : spanChildrenCount > 1;

    if (value) {
      this.space = [
        value.start_timestamp * 1e3,
        (value.timestamp - value.start_timestamp) * 1e3,
      ];

      if ('performance_issues' in value && Array.isArray(value.performance_issues)) {
        value.performance_issues.forEach(issue => this.occurrences.add(issue));
      }
    }

    this.parent?.children.push(this);
    this.parent?.children.sort(traceChronologicalSort);
  }

  get type(): TraceTree.NodeType {
    return 'txn';
  }

  get id(): string {
    return this.value.event_id;
  }

  get projectSlug(): string {
    return this.value.project_slug;
  }

  get op(): string {
    return this.value['transaction.op'];
  }

  get description(): string {
    return this.value.transaction;
  }

  get startTimestamp(): number {
    return this.value.start_timestamp;
  }

  get endTimestamp(): number {
    return this.value.timestamp;
  }

  get drawerTabsTitle(): string {
    return this.op + (this.value.transaction ? ' - ' + this.value.transaction : '');
  }

  get traceHeaderTitle(): {
    title: string;
    subtitle?: string;
  } {
    return {title: this.op || t('Trace'), subtitle: this.value.transaction};
  }

  pathToNode(): TraceTree.NodePath[] {
    return [this.path];
  }

  matchById(id: string): boolean {
    const hasMatchingErrors = Array.from(this.errors).some(
      error => error.event_id === id
    );
    const hasMatchingOccurrences = Array.from(this.occurrences).some(
      occurrence => occurrence.event_id === id
    );
    return (
      this.value.event_id === id ||
      this.value.span_id === id ||
      hasMatchingErrors ||
      hasMatchingOccurrences
    );
  }

  expand(expanding: boolean, tree: TraceTree): boolean {
    // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
    const index = tree.list.indexOf(this);

    // Expanding is not allowed for zoomed in nodes
    if (expanding === this.expanded || this.hasFetchedChildren) {
      return false;
    }

    if (expanding) {
      // Flip expanded so that we can collect visible children
      this.expanded = expanding;

      // Flip expanded so that we can collect visible children
      // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
      tree.list.splice(index + 1, 0, ...this.visibleChildren);
    } else {
      tree.list.splice(index + 1, this.visibleChildren.length);

      this.expanded = expanding;

      // When transaction nodes are collapsed, they still render child transactions
      // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
      tree.list.splice(index + 1, 0, ...this.visibleChildren);
    }

    this.invalidate();
    this.forEachChild(child => child.invalidate());
    return true;
  }

  makeBarColor(theme: Theme): string {
    return pickBarColor(
      getStylingSliceName(this.value.project_slug, this.value.sdk_name) ?? this.op,
      theme
    );
  }

  renderWaterfallRow<T extends TraceTree.Node>(props: TraceRowProps<T>): React.ReactNode {
    // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
    return <TraceTransactionRow {...props} node={props.node} />;
  }

  renderDetails<T extends TraceTreeNode<TraceTree.NodeValue>>(
    props: TraceTreeNodeDetailsProps<T>
  ): React.ReactNode {
    return (
      <TransactionNodeDetails
        {...props}
        // Won't need this cast once we use BaseNode type for props.node
        node={props.node as TraceTreeNode<TraceTree.Transaction>}
      />
    );
  }

  printNode(): string {
    return (
      (this.value.transaction || 'unknown transaction') +
      ' - ' +
      (this.op ?? 'unknown op')
    );
  }

  analyticsName(): string {
    return 'transaction';
  }

  matchByPath(path: TraceTree.NodePath): boolean {
    const [type, id] = path.split('-');
    if (type !== 'txn' || !id) {
      return false;
    }

    return this.matchById(id);
  }

  matchWithFreeText(query: string): boolean {
    return (
      this.op?.includes(query) || this.description?.includes(query) || this.id === query
    );
  }

  fetchChildren(
    fetching: boolean,
    tree: TraceTree,
    options: {
      api: Client;
      preferences: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
    }
  ): Promise<EventTransaction | null> {
    if (fetching === this.hasFetchedChildren || !this.canFetchChildren) {
      return Promise.resolve(null);
    }

    if (!fetching) {
      // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
      const index = tree.list.indexOf(this);

      // Remove currently visible children
      tree.list.splice(index + 1, this.visibleChildren.length);

      // Flip visibility
      this.hasFetchedChildren = fetching;

      // When transactions are zoomed out, they still render child transactions
      // Find all transactions that are children of the current transaction
      // remove all non transaction events from current node and its children
      // point transactions back to their parents
      // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
      const transactions = this.findAllChildren(c => isTransactionNode(c) && c !== this);

      for (const trace of transactions) {
        // point transactions back to their parents
        // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
        const parent = trace.findParent(p => isTransactionNode(p));

        // If they already have the correct parent, then we can skip this
        if (trace.parent === parent) {
          continue;
        }

        if (!parent) {
          Sentry.withScope(scope => {
            scope.setFingerprint(['trace-view-transaction-parent']);
            scope.captureMessage('Failed to find parent transaction when zooming out');
            info(fmt`Failed to find parent transaction when zooming out`);
          });
          continue;
        }
        trace.parent = parent;
        parent.children.push(trace);
      }

      // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
      this.children = this.children.filter(c => isTransactionNode(c));
      this.children.sort(traceChronologicalSort);

      // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
      tree.list.splice(index + 1, 0, ...this.visibleChildren);

      this.invalidate();
      this.forEachChild(child => child.invalidate());
      return Promise.resolve(null);
    }

    const key = this.extra.organization.slug + ':' + this.projectSlug + ':' + this.id;

    const promise =
      this._spanPromises.get(key) ??
      fetchTransactionSpans(
        options.api,
        this.extra.organization,
        this.projectSlug,
        this.id
      );

    this.fetchStatus = 'loading';

    promise
      .then((data: EventTransaction) => {
        // The user may have collapsed the node before the promise resolved. When that
        // happens, dont update the tree with the resolved data. Alternatively, we could implement
        // a cancellable promise and avoid this cumbersome heuristic.
        // Remove existing entries from the list
        // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
        const index = tree.list.indexOf(this);
        this.fetchStatus = 'resolved';

        if (this.expanded && index !== -1) {
          const childrenCount = this.visibleChildren.length;
          if (childrenCount > 0) {
            tree.list.splice(index + 1, childrenCount);
          }
        }

        // API response is not sorted
        const spans = data.entries.find(s => s.type === 'spans') ?? {data: []};
        spans.data.sort((a: any, b: any) => a.start_timestamp - b.start_timestamp);

        // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
        const [root, spanTreeSpaceBounds] = this._fromSpans(this, spans.data, data);

        // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
        root.hasFetchedChildren = true;
        // Spans contain millisecond precision, which means that it is possible for the
        // children spans of a transaction to extend beyond the start and end of the transaction
        // through ns precision. To account for this, we need to adjust the space of the transaction node and the space
        // of our trace so that all of the span children are visible and can be rendered inside the view
        const previousStart = tree.root.space[0];
        const previousDuration = tree.root.space[1];

        const newStart = spanTreeSpaceBounds[0];
        const newEnd = spanTreeSpaceBounds[0] + spanTreeSpaceBounds[1];

        // Extend the start of the trace to include the new min start
        if (newStart <= tree.root.space[0]) {
          tree.root.space[0] = newStart;
        }
        // Extend the end of the trace to include the new max end
        if (newEnd > tree.root.space[0] + tree.root.space[1]) {
          tree.root.space[1] = newEnd - tree.root.space[0];
        }

        if (
          previousStart !== tree.root.space[0] ||
          previousDuration !== tree.root.space[1]
        ) {
          tree.dispatch('trace timeline change', tree.root.space);
        }

        this._applyPreferences(root, {
          organization: this.extra.organization,
          preferences: options.preferences,
        });

        if (index !== -1) {
          // @ts-expect-error Abdullah Khan: Will be fixed as BaseNode is used in TraceTree
          tree.list.splice(index + 1, 0, ...this.visibleChildren);
        }
        return data;
      })
      .catch(_e => {
        this.fetchStatus = 'error';
      });

    this._spanPromises.set(key, promise);
    return promise;
  }
}

function fetchTransactionSpans(
  api: Client,
  organization: Organization,
  project_slug: string,
  event_id: string
): Promise<EventTransaction> {
  return api.requestPromise(
    `/organizations/${organization.slug}/events/${project_slug}:${event_id}/?averageColumn=span.self_time&averageColumn=span.duration`
  );
}
