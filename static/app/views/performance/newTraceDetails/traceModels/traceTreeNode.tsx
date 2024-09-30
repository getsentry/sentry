import type {Theme} from '@emotion/react';

import type {TraceTree} from './traceTree';

export class TraceTreeNode<T extends TraceTree.NodeValue = TraceTree.NodeValue> {
  cloneReference: TraceTreeNode<TraceTree.NodeValue> | null = null;
  canFetch: boolean = false;
  fetchStatus: 'resolved' | 'error' | 'idle' | 'loading' = 'idle';
  parent: TraceTreeNode | null = null;
  reparent_reason: 'pageload server handler' | null = null;
  value: T;
  expanded: boolean = false;
  zoomedIn: boolean = false;
  metadata: TraceTree.Metadata = {
    project_slug: undefined,
    event_id: undefined,
  };

  errors: Set<TraceTree.TraceError> = new Set<TraceTree.TraceError>();
  performance_issues: Set<TraceTree.TracePerformanceIssue> =
    new Set<TraceTree.TracePerformanceIssue>();
  profiles: TraceTree.Profile[] = [];

  multiplier: number;
  space: [number, number] = [0, 0];

  private unit = 'milliseconds' as const;
  private _depth: number | undefined;
  private _children: TraceTreeNode[] = [];
  private _spanChildren: TraceTreeNode[] = [];
  private _connectors: number[] | undefined = undefined;

  constructor(parent: TraceTreeNode | null, value: T, metadata: TraceTree.Metadata) {
    this.parent = parent ?? null;
    this.value = value;
    this.metadata = metadata;
    this.multiplier = this.unit === 'milliseconds' ? 1e3 : 1;

    if (
      value &&
      'timestamp' in value &&
      'start_timestamp' in value &&
      typeof value.timestamp === 'number' &&
      typeof value.start_timestamp === 'number'
    ) {
      this.space = [
        value.start_timestamp * this.multiplier,
        (value.timestamp - value.start_timestamp) * this.multiplier,
      ];
    } else if (value && 'timestamp' in value && typeof value.timestamp === 'number') {
      this.space = [value.timestamp * this.multiplier, 0];
    }

    if (
      isTraceErrorNode(this) &&
      'timestamp' in this.value &&
      typeof this.value.timestamp === 'number'
    ) {
      this.space = [this.value.timestamp * this.multiplier, 0];
    }

    if (value && 'profile_id' in value && typeof value.profile_id === 'string') {
      this.profiles.push({profile_id: value.profile_id, space: this.space ?? [0, 0]});
    }

    if (isTransactionNode(this) || isTraceNode(this) || isSpanNode(this)) {
      this.expanded = true;
    }

    if (shouldCollapseNodeByDefault(this)) {
      this.expanded = false;
    }

    if (isTransactionNode(this)) {
      this.errors = new Set(this.value.errors);
      this.performance_issues = new Set(this.value.performance_issues);
    }

    // For error nodes, its value is the only associated issue.
    if (isTraceErrorNode(this)) {
      this.errors = new Set([this.value]);
    }
  }

  get isOrphaned() {
    return this.parent?.value && 'orphan_errors' in this.parent.value;
  }

  get isLastChild() {
    if (!this.parent || this.parent.children.length === 0) {
      return true;
    }

    return this.parent.children[this.parent.children.length - 1] === this;
  }

  /**
   * Return a lazily calculated depth of the node in the tree.
   * Root node has a value of -1 as it is abstract.
   */
  get depth(): number {
    if (typeof this._depth === 'number') {
      return this._depth;
    }

    let depth = -2;
    let node: TraceTreeNode<any> | null = this;

    while (node) {
      if (typeof node.parent?.depth === 'number') {
        this._depth = node.parent.depth + 1;
        return this._depth;
      }
      depth++;
      node = node.parent;
    }

    this._depth = depth;
    return this._depth;
  }

  get has_errors(): boolean {
    return this.errors.size > 0 || this.performance_issues.size > 0;
  }

  get parent_transaction(): TraceTreeNode<TraceTree.Transaction> | null {
    let node: TraceTreeNode<TraceTree.NodeValue> | null = this.parent;

    while (node) {
      if (isTransactionNode(node)) {
        return node;
      }
      node = node.parent;
    }

    return null;
  }

  /**
   * Returns the depth levels at which the row should draw vertical connectors
   * negative values mean connector points to an orphaned node
   */
  get connectors(): number[] {
    if (this._connectors !== undefined) {
      return this._connectors!;
    }

    this._connectors = [];

    if (!this.parent) {
      return this._connectors;
    }

    if (this.parent?.connectors !== undefined) {
      this._connectors = [...this.parent.connectors];

      if (this.isLastChild || this.value === null) {
        return this._connectors;
      }

      this.connectors.push(this.isOrphaned ? -this.depth : this.depth);
      return this._connectors;
    }

    let node: TraceTreeNode<T> | TraceTreeNode<TraceTree.NodeValue> | null = this.parent;

    while (node) {
      if (node.value === null) {
        break;
      }

      if (node.isLastChild) {
        node = node.parent;
        continue;
      }

      this._connectors.push(node.isOrphaned ? -node.depth : node.depth);
      node = node.parent;
    }

    return this._connectors;
  }

  set connectors(connectors: number[] | undefined) {
    this._connectors = connectors;
  }
  set depth(depth: number | undefined) {
    this._depth = depth;
  }

  /**
   * Returns the children that the node currently points to.
   * The logic here is a consequence of the tree design, where we want to be able to store
   * both transaction and span nodes in the same tree. This results in an annoying API where
   * we either store span children separately or transaction children separately. A better design
   * would have been to create an invisible meta node that always points to the correct children.
   */
  get children(): TraceTreeNode[] {
    if (isAutogroupedNode(this)) {
      return this._children;
    }

    if (isSpanNode(this)) {
      return this.canFetch && !this.zoomedIn ? [] : this.spanChildren;
    }

    if (isTransactionNode(this)) {
      return this.zoomedIn ? this._spanChildren : this._children;
    }

    return this._children;
  }

  set children(children: TraceTreeNode[]) {
    this._children = children;
  }

  get spanChildren(): TraceTreeNode[] {
    return this._spanChildren;
  }

  private _max_severity: keyof Theme['level'] | undefined;
  get max_severity(): keyof Theme['level'] {
    if (this._max_severity) {
      return this._max_severity;
    }

    for (const error of this.errors) {
      if (error.level === 'error' || error.level === 'fatal') {
        this._max_severity = error.level;
        return this.max_severity;
      }
    }

    return 'default';
  }

  static Root() {
    return new TraceTreeNode(null, null, {
      event_id: undefined,
      project_slug: undefined,
    });
  }
}

function shouldCollapseNodeByDefault(node: TraceTreeNode<TraceTree.NodeValue>) {
  if (isSpanNode(node)) {
    // Android creates TCP connection spans which are noisy and not useful in most cases.
    // Unless the span has a child txn which would indicate a continuaton of the trace, we collapse it.
    if (
      node.value.op === 'http.client' &&
      node.value.origin === 'auto.http.okhttp' &&
      !node.value.childTransactions.length
    ) {
      return true;
    }
  }

  return false;
}

// Generates a ID of the tree node based on its type
function nodeToId(n: TraceTreeNode<TraceTree.NodeValue>): TraceTree.NodePath {
  if (isAutogroupedNode(n)) {
    if (isParentAutogroupedNode(n)) {
      return `ag-${n.head.value.span_id}`;
    }
    if (isSiblingAutogroupedNode(n)) {
      const child = n.children[0];
      if (isSpanNode(child)) {
        return `ag-${child.value.span_id}`;
      }
    }
  }
  if (isTransactionNode(n)) {
    return `txn-${n.value.event_id}`;
  }
  if (isSpanNode(n)) {
    return `span-${n.value.span_id}`;
  }
  if (isTraceNode(n)) {
    return `trace-root`;
  }

  if (isTraceErrorNode(n)) {
    return `error-${n.value.event_id}`;
  }

  if (isRootNode(n)) {
    throw new Error('A path to root node does not exist as the node is virtual');
  }

  if (isMissingInstrumentationNode(n)) {
    if (n.previous) {
      return `ms-${n.previous.value.span_id}`;
    }
    if (n.next) {
      return `ms-${n.next.value.span_id}`;
    }

    throw new Error('Missing instrumentation node must have a previous or next node');
  }

  throw new Error('Not implemented');
}

export function printTraceTreeNode(
  t: TraceTreeNode<TraceTree.NodeValue>,
  offset: number
): string {
  // +1 because we may be printing from the root which is -1 indexed
  const padding = '  '.repeat(t.depth + offset);

  if (isAutogroupedNode(t)) {
    if (isParentAutogroupedNode(t)) {
      return padding + `parent autogroup (${t.groupCount})`;
    }
    if (isSiblingAutogroupedNode(t)) {
      return padding + `sibling autogroup (${t.groupCount})`;
    }

    return padding + 'autogroup';
  }
  if (isSpanNode(t)) {
    return padding + (t.value.op || t.value.span_id || 'unknown span');
  }
  if (isTransactionNode(t)) {
    return padding + (t.value.transaction || 'unknown transaction');
  }
  if (isMissingInstrumentationNode(t)) {
    return padding + 'missing_instrumentation';
  }
  if (isRootNode(t)) {
    return padding + 'Root';
  }
  if (isTraceNode(t)) {
    return padding + 'Trace';
  }

  if (isTraceErrorNode(t)) {
    return padding + (t.value.event_id || t.value.level) || 'unknown trace error';
  }

  return 'unknown node';
}
