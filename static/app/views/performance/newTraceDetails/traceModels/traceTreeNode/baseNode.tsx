import type {Theme} from '@emotion/react';

import type {Client} from 'sentry/api';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import type {Measurement} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {TraceItemDataset} from 'sentry/views/explore/types';
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {
  isEAPSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import type {EapSpanNode} from './eapSpanNode';
import type {TransactionNode} from './transactionNode';

export interface TraceTreeNodeExtra {
  organization: Organization;
  meta?: TraceMetaQueryResults['data'] | null;
  // This is used to track the traceslug associated with a trace in a replay.
  // This is necessary because a replay has multiple traces and the current ui requires
  // us to merge them into one trace. We still need to keep track of the original traceSlug
  // to be able to fetch the correct trace-item details from EAP, in the trace drawer.
  replayTraceSlug?: string;
}

export abstract class BaseNode<T extends TraceTree.NodeValue = TraceTree.NodeValue> {
  abstract id: string;

  abstract type: TraceTree.NodeType;

  /**
   * The parent node of this node.
   */
  parent: BaseNode | null = null;

  /**
   * The reason why this node was reparented. A use case for this is when a server request span
   * is reparented under a browser request span, to make the SSR trace tree more intuitive.
   */
  reparent_reason: 'pageload server handler' | null = null;

  /**
   * The value of the node.
   */
  value: T;

  /**
   * Whether this node can fetch further children. An example is fetching embedded spans for a transaction node.
   */
  canFetchChildren = false;

  /**
   * This is the status of the node's fetch children operation.
   */
  fetchStatus: 'resolved' | 'error' | 'idle' | 'loading' = 'idle';

  /**
   * Whether this node has fetched further children.
   */
  hasFetchedChildren = false;

  /**
   * Whether this node is expanded.
   */
  expanded = true;

  /**
   * Whether this should be considered when detecting no instrumentation between spans.
   */
  allowNoInstrumentationNodes = false;

  /**
   * Whether this node can be autogrouped.
   */
  canAutogroup = false;

  /**
   * Can show details in the trace drawer.
   */
  canShowDetails = true;

  /**
   * The errors associated with the node.
   */
  errors = new Set<TraceTree.TraceErrorIssue>();

  /**
   * The occurrences associated with the node, mainly performance issues.
   */
  occurrences = new Set<TraceTree.TraceOccurrence>();

  /**
   * The space associated with the node. The first value is the start timestamp in milliseconds,
   * the second value is the duration in milliseconds.
   */
  space: [number, number] = [0, 0];

  /**
   * The children of the node.
   */
  children: BaseNode[] = [];

  /**
   * The depth of the node. Useful for determining the node's position in the tree.
   */
  depth: number | undefined;

  /**
   * The connectors of the node. Used to render connecting lines between nodes.
   */
  connectors: number[] | undefined;

  /**
   * The extra options for the node. Examples include the organization to check for enabled features.
   */
  extra: TraceTreeNodeExtra | null;

  /**
   * Whether the node is an EAP event.
   */
  isEAPEvent = false;

  /**
   * The dataset used to fetch the details for the item. If not provided we fetch from nodestore.
   */
  traceItemDataset: TraceItemDataset | null = null;

  /**
   * The priority of the node in when we find multiple nodes matching the same search query.
   */
  searchPriority = 0;

  /**
   * The maximum severity of the node's issues.
   */
  private _max_severity: keyof Theme['level'] | undefined;

  constructor(parent: BaseNode | null, value: T, extra: TraceTreeNodeExtra | null) {
    this.parent = parent;
    this.value = value;
    this.extra = extra;

    if (value) {
      if (
        'end_timestamp' in value &&
        typeof value.end_timestamp === 'number' &&
        'start_timestamp' in value &&
        typeof value.start_timestamp === 'number'
      ) {
        this.space = [
          value.start_timestamp * 1e3,
          (value.end_timestamp - value.start_timestamp) * 1e3,
        ];
      } else if (
        value &&
        'end_timestamp' in value &&
        typeof value.end_timestamp === 'number'
      ) {
        this.space = [value.end_timestamp * 1e3, 0];
      } else if (
        value &&
        'start_timestamp' in value &&
        typeof value.start_timestamp === 'number'
      ) {
        this.space = [value.start_timestamp * 1e3, 0];
      }

      if ('errors' in value && Array.isArray(value.errors)) {
        value.errors.forEach(error => this.errors.add(error));
      }

      if ('occurrences' in value && Array.isArray(value.occurrences)) {
        value.occurrences.forEach(occurence => this.occurrences.add(occurence));
      }
    }
  }

  get op(): string | undefined {
    return this.value && 'op' in this.value ? this.value.op : undefined;
  }

  get projectSlug(): string | undefined {
    return this.value && 'project_slug' in this.value
      ? this.value.project_slug
      : undefined;
  }

  get profileId(): string | undefined {
    return this.value && 'profile_id' in this.value
      ? this.value.profile_id?.trim() || undefined
      : undefined;
  }

  get profilerId(): string | undefined {
    return this.value && 'profiler_id' in this.value
      ? this.value.profiler_id?.trim() || undefined
      : undefined;
  }

  get projectId(): number | undefined {
    return this.value && 'project_id' in this.value ? this.value.project_id : undefined;
  }

  get description(): string | undefined {
    return this.value && 'description' in this.value ? this.value.description : undefined;
  }

  get startTimestamp(): number | undefined {
    return this.value && 'start_timestamp' in this.value
      ? this.value.start_timestamp
      : undefined;
  }

  get endTimestamp(): number | undefined {
    return this.value && 'end_timestamp' in this.value
      ? this.value.end_timestamp
      : undefined;
  }

  get sdkName(): string | undefined {
    return this.value && 'sdk_name' in this.value ? this.value.sdk_name : undefined;
  }

  get uniqueErrorIssues(): TraceTree.TraceErrorIssue[] {
    const unique: TraceTree.TraceErrorIssue[] = [];
    const seenIssues: Set<number> = new Set();

    for (const error of this.errors) {
      if (seenIssues.has(error.issue_id)) {
        continue;
      }
      seenIssues.add(error.issue_id);
      unique.push(error);
    }

    return unique;
  }

  get uniqueOccurrenceIssues(): TraceTree.TraceOccurrence[] {
    const unique: TraceTree.TraceOccurrence[] = [];
    const seenIssues: Set<number> = new Set();

    for (const issue of this.occurrences) {
      if (seenIssues.has(issue.issue_id)) {
        continue;
      }
      seenIssues.add(issue.issue_id);
      unique.push(issue);
    }

    return unique;
  }

  get uniqueIssues(): TraceTree.TraceIssue[] {
    return [...this.uniqueErrorIssues, ...this.uniqueOccurrenceIssues];
  }

  get hasErrors(): boolean {
    return this.errors.size > 0;
  }

  get hasProfiles(): boolean {
    return !!(this.profileId || this.profilerId);
  }

  get hasOccurrences(): boolean {
    return this.occurrences.size > 0;
  }

  get hasIssues(): boolean {
    return this.hasErrors || this.hasOccurrences;
  }

  get visibleChildren(): BaseNode[] {
    const queue: BaseNode[] = [];
    const visibleChildren: BaseNode[] = [];
    if (this.directVisibleChildren.length > 0) {
      for (let i = this.directVisibleChildren.length - 1; i >= 0; i--) {
        queue.push(this.directVisibleChildren[i]!);
      }
    }

    while (queue.length > 0) {
      const node = queue.pop()!;

      visibleChildren.push(node);

      // iterate in reverse to ensure nodes are processed in order
      if (node.directVisibleChildren.length > 0) {
        for (let i = node.directVisibleChildren.length - 1; i >= 0; i--) {
          queue.push(node.directVisibleChildren[i]!);
        }
      }
    }

    return visibleChildren;
  }

  get directVisibleChildren(): BaseNode[] {
    if (!this.expanded) {
      return [];
    }

    return this.children;
  }

  get maxIssueSeverity(): keyof Theme['level'] {
    if (this._max_severity) {
      return this._max_severity;
    }

    for (const error of this.errors) {
      if (error.level === 'error' || error.level === 'fatal') {
        this._max_severity = error.level;
        return this._max_severity;
      }
    }

    return 'default';
  }

  get path(): TraceTree.NodePath {
    return `${this.type}-${this.id}`;
  }

  get transactionId(): string | undefined {
    return this.value && 'transaction_id' in this.value
      ? this.value.transaction_id
      : undefined;
  }

  private _isValidMeasurements(
    measurements: Record<string, any>
  ): measurements is Record<string, Measurement> {
    return Object.values(measurements).every(
      m => m && 'value' in m && typeof m.value === 'number'
    );
  }

  get measurements(): Record<string, Measurement> | undefined {
    if (
      this.value &&
      'measurements' in this.value &&
      this.value.measurements &&
      this._isValidMeasurements(this.value.measurements)
    ) {
      return this.value.measurements;
    }

    return undefined;
  }

  get attributes(): Record<string, string | number | boolean> | undefined {
    return this.value && 'additional_attributes' in this.value
      ? this.value.additional_attributes
      : undefined;
  }

  get traceOrigin(): number {
    return (
      ((this.value &&
        Array.isArray(this.value) &&
        this.value[0] &&
        'additional_attributes' in this.value[0] &&
        (this.value[0].additional_attributes?.[
          'tags[performance.timeOrigin,number]'
        ] as number)) ||
        0) * 1000
    );
  }

  isRootNodeChild(): boolean {
    return this.parent?.value === null;
  }

  isLastChild(): boolean {
    if (!this.parent) {
      return false;
    }

    const visibleChildren = this.parent.directVisibleChildren;
    return visibleChildren[visibleChildren.length - 1] === this;
  }

  hasVisibleChildren(): boolean {
    return this.visibleChildren.length > 0;
  }

  matchById(id: string): boolean {
    const hasMatchingErrors = Array.from(this.errors).some(
      error => error.event_id === id
    );
    const hasMatchingOccurrences = Array.from(this.occurrences).some(
      occurrence => occurrence.event_id === id
    );

    return this.id === id || hasMatchingErrors || hasMatchingOccurrences;
  }

  invalidate() {
    this.connectors = undefined;
    this.depth = undefined;
  }

  getNextTraversalNodes(): BaseNode[] {
    return this.children;
  }

  findChild<ChildType extends BaseNode = BaseNode>(
    predicate: (child: BaseNode) => boolean
  ): ChildType | null {
    const queue: BaseNode[] = [...this.getNextTraversalNodes()];

    while (queue.length > 0) {
      const next = queue.pop()!;

      if (predicate(next)) {
        return next as ChildType;
      }

      const children = next.getNextTraversalNodes();
      for (let i = children.length - 1; i >= 0; i--) {
        queue.push(children[i]!);
      }
    }

    return null;
  }

  findAllChildren<ChildType extends BaseNode = BaseNode>(
    predicate: (child: BaseNode) => boolean
  ): ChildType[] {
    const queue: BaseNode[] = [...this.getNextTraversalNodes()];
    const results: ChildType[] = [];

    while (queue.length > 0) {
      const next = queue.pop()!;

      if (predicate(next)) {
        results.push(next as ChildType);
      }

      const children = next.getNextTraversalNodes();
      for (let i = children.length - 1; i >= 0; i--) {
        queue.push(children[i]!);
      }
    }

    return results;
  }

  forEachChild(callback: (child: BaseNode) => void) {
    const queue: BaseNode[] = [...this.getNextTraversalNodes()];

    while (queue.length > 0) {
      const next = queue.pop()!;

      callback(next);

      const children = next.getNextTraversalNodes();
      for (let i = children.length - 1; i >= 0; i--) {
        queue.push(children[i]!);
      }
    }
  }

  findParent<ChildType extends BaseNode = BaseNode>(
    predicate: (parent: BaseNode) => boolean
  ): ChildType | null {
    let current = this.parent;
    while (current) {
      if (predicate(current)) {
        return current as ChildType;
      }
      current = current.parent;
    }
    return null;
  }

  findClosestParentTransaction(): TransactionNode | EapSpanNode | null {
    const nodeStoreTransaction = this.findParentNodeStoreTransaction();
    if (nodeStoreTransaction) {
      return nodeStoreTransaction;
    }

    const eapTransaction = this.findParentEapTransaction();
    if (eapTransaction) {
      return eapTransaction;
    }

    return null;
  }

  findParentNodeStoreTransaction(): TransactionNode | null {
    return this.findParent<TransactionNode>(p => isTransactionNode(p));
  }

  findParentEapTransaction(): EapSpanNode | null {
    return this.findParent<EapSpanNode>(p => isEAPSpanNode(p) && p.value.is_transaction);
  }

  expand(expanding: boolean, tree: TraceTree): boolean {
    const index = tree.list.indexOf(this);

    // Expanding is not allowed for zoomed in nodes
    if (expanding === this.expanded || this.hasFetchedChildren) {
      return false;
    }

    if (expanding) {
      // Flip expanded so that we can collect visible children
      this.expanded = expanding;

      // Flip expanded so that we can collect visible children
      tree.list.splice(index + 1, 0, ...this.visibleChildren);
    } else {
      tree.list.splice(index + 1, this.visibleChildren.length);

      this.expanded = expanding;
    }

    this.invalidate();
    this.forEachChild(child => child.invalidate());
    return true;
  }

  makeBarTextColor(inside: boolean, theme: Theme): string {
    return inside ? 'white' : theme.tokens.content.secondary;
  }

  /**
   * Makes the color of the node's bar in the waterfall.
   */
  makeBarColor(theme: Theme): string {
    return pickBarColor('default', theme);
  }

  /**
   * Fetches and adds children to this node.
   * Returns the bounds of the added subtree as [start, end] timestamps.
   * This can be used by the tree to update its overall bounds if the new children
   * extend beyond the tree's current bounds.
   */
  fetchChildren(
    _fetching: boolean,
    _tree: TraceTree,
    _options: {
      api: Client;
    }
  ): Promise<[number, number] | null> {
    return Promise.resolve(null);
  }

  pathToNode(): TraceTree.NodePath[] {
    const path = this.path;

    if (!path) {
      return [];
    }

    const closestFetchableParent = this.findParent(p => p.canFetchChildren);

    if (closestFetchableParent) {
      return [path, ...closestFetchableParent.pathToNode()];
    }

    return [path];
  }

  matchByPath(path: TraceTree.NodePath): boolean {
    if (!path.startsWith(`${this.type}-`)) {
      return false;
    }

    // Extract id after the first occurrence of `${this.type}-`
    const id = path.slice(this.type.length + 1);
    if (!id) {
      return false;
    }
    return this.id === id;
  }

  abstract get drawerTabsTitle(): string;

  abstract get traceHeaderTitle(): {
    title: string;
    subtitle?: string;
  };

  abstract analyticsName(): string;

  /**
   * Prints the node in a human readable format for debugging purposes. Used in snapshot tests.
   */
  abstract printNode(): string;

  abstract renderWaterfallRow<NodeType extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<NodeType>
  ): React.ReactNode;

  abstract renderDetails<NodeType extends BaseNode>(
    props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode;

  abstract matchWithFreeText(key: string): boolean;

  abstract resolveValueFromSearchKey(key: string): any | null;
}
