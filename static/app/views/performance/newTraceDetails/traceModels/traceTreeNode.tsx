import type {Theme} from '@emotion/react';

import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isRootNode,
  isSiblingAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTraceNode,
  isTransactionNode,
} from '../traceGuards';

import type {TraceTree} from './traceTree';

export class TraceTreeNode<T extends TraceTree.NodeValue = TraceTree.NodeValue> {
  cloneReference: TraceTreeNode<TraceTree.NodeValue> | null = null;
  canFetch: boolean = false;
  fetchStatus: 'resolved' | 'error' | 'idle' | 'loading' = 'idle';
  parent: TraceTreeNode | null = null;
  reparent_reason: 'pageload server handler' | null = null;
  value: T;
  expanded: boolean = true;
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
  private _max_severity: keyof Theme['level'] | undefined;

  constructor(parent: TraceTreeNode | null, value: T, metadata: TraceTree.Metadata) {
    this.parent = parent;
    this.value = value;
    this.metadata = metadata;
    this.multiplier = this.unit === 'milliseconds' ? 1e3 : 1;

    // If we have a timestamp and start_timestamp, convert it to x, width coordinates
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

    // Store profile reference into the node itself
    if (value && 'profile_id' in value && typeof value.profile_id === 'string') {
      this.profiles.push({profile_id: value.profile_id, space: this.space ?? [0, 0]});
    }

    // Some nodes should not be expanded by default, for example Android SDK generates
    // spans things like DNS resolution, which are not very useful to the user and generate
    // a lot of noise. We want to collapse them by default.
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

  static Root() {
    return new TraceTreeNode(null, null, {
      event_id: undefined,
      project_slug: undefined,
    });
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

  get hasErrors(): boolean {
    return this.errors.size > 0 || this.performance_issues.size > 0;
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

  get maxErrorSeverity(): keyof Theme['level'] {
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

  /**
   * Invalidate the visual data used to render the tree, forcing it
   * to be recalculated on the next render. This is useful when for example
   * the tree is expanded or collapsed, or when the tree is mutated and
   * the visual data is no longer valid as the indentation changes
   */
  invalidate(root?: TraceTreeNode<TraceTree.NodeValue>) {
    this._connectors = undefined;
    this._depth = undefined;

    if (root) {
      const queue = [...this.children];

      if (isParentAutogroupedNode(this)) {
        queue.push(this.head);
      }

      while (queue.length > 0) {
        const next = queue.pop()!;
        next.invalidate();

        if (isParentAutogroupedNode(next)) {
          queue.push(next.head);
        }

        for (let i = 0; i < next.children.length; i++) {
          queue.push(next.children[i]);
        }
      }
    }
  }

  getVisibleChildrenCount(): number {
    return this.getVisibleChildren().length;
  }

  getVisibleChildren(): TraceTreeNode<TraceTree.NodeValue>[] {
    const stack: TraceTreeNode<TraceTree.NodeValue>[] = [];
    const children: TraceTreeNode<TraceTree.NodeValue>[] = [];

    if (
      this.expanded ||
      isParentAutogroupedNode(this) ||
      isMissingInstrumentationNode(this)
    ) {
      for (let i = this.children.length - 1; i >= 0; i--) {
        stack.push(this.children[i]);
      }
    }

    while (stack.length > 0) {
      const node = stack.pop()!;
      children.push(node);
      // Since we're using a stack and it's LIFO, reverse iterate over the children
      // to ensure they are processed in the original left-to-right order.
      if (node.expanded || isParentAutogroupedNode(node)) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
      }
    }

    return children;
  }

  // Returns the min path required to reach the node from the root.
  // @TODO: skip nodes that do not require fetching
  get path(): TraceTree.NodePath[] {
    const nodes: TraceTreeNode<TraceTree.NodeValue>[] = [this];
    let current: TraceTreeNode<TraceTree.NodeValue> | null = this.parent;

    if (isSpanNode(this) || isAutogroupedNode(this)) {
      while (
        current &&
        (isSpanNode(current) || (isAutogroupedNode(current) && !current.expanded))
      ) {
        current = current.parent;
      }
    }

    while (current) {
      if (isTransactionNode(current)) {
        nodes.push(current);
      }
      if (isSpanNode(current)) {
        nodes.push(current);

        while (current.parent) {
          if (isTransactionNode(current.parent)) {
            break;
          }
          if (isAutogroupedNode(current.parent) && current.parent.expanded) {
            break;
          }
          current = current.parent;
        }
      }
      if (isAutogroupedNode(current)) {
        nodes.push(current);
      }

      current = current.parent;
    }

    return nodes.map(nodeToId);
  }

  print() {
    // root nodes are -1 indexed, so we add 1 to the depth so .repeat doesnt throw
    const offset = this.depth === -1 ? 1 : 0;
    const nodes = [this, ...this.getVisibleChildren()];
    const print = nodes
      .map(t => printTraceTreeNode(t, offset))
      .filter(Boolean)
      .join('\n');

    // eslint-disable-next-line no-console
    console.log(print);
  }

  static Find(
    root: TraceTreeNode<TraceTree.NodeValue>,
    predicate: (node: TraceTreeNode<TraceTree.NodeValue>) => boolean
  ): TraceTreeNode<TraceTree.NodeValue> | null {
    const queue = [root];

    while (queue.length > 0) {
      const next = queue.pop()!;

      if (predicate(next)) {
        return next;
      }

      if (isParentAutogroupedNode(next)) {
        queue.push(next.head);
      } else {
        for (const child of next.children) {
          queue.push(child);
        }
      }
    }

    return null;
  }

  static Filter(
    root: TraceTreeNode<TraceTree.NodeValue>,
    predicate: (node: TraceTreeNode) => boolean
  ): TraceTreeNode<TraceTree.NodeValue> {
    const queue = [root];

    while (queue.length) {
      const next = queue.pop()!;
      for (let i = 0; i < next.children.length; i++) {
        if (!predicate(next.children[i])) {
          next.children.splice(i, 1);
        } else {
          queue.push(next.children[i]);
        }
      }
    }

    return root;
  }

  static ForEachChild(
    root: TraceTreeNode<TraceTree.NodeValue>,
    cb: (node: TraceTreeNode<TraceTree.NodeValue>) => void
  ): void {
    const queue = [root];

    while (queue.length > 0) {
      const next = queue.pop()!;
      cb(next);

      if (isParentAutogroupedNode(next)) {
        queue.push(next.head);
      } else {
        const children = next.spanChildren ? next.spanChildren : next.children;
        for (const child of children) {
          queue.push(child);
        }
      }
    }
  }
}

// If the node should not be expanded by default
function shouldCollapseNodeByDefault(node: TraceTreeNode<TraceTree.NodeValue>) {
  if (isSpanNode(node)) {
    // Android creates TCP connection spans which are noisy and not useful in most cases.
    // Unless the span has a child txn which would indicate a continuaton of the trace, we collapse it.
    if (
      node.value.op === 'http.client' &&
      node.value.origin === 'auto.http.okhttp' &&
      // If the span has a child transaction, we assume it's a continuation of the trace
      // and we don't collapse it by default.
      !node.value.childTransactions.length
    ) {
      return true;
    }
  }

  return false;
}

// Generates a id that we can later use to resolve back to the node in our tree
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
      return padding + `Parent autogroup (${t.groupCount})`;
    }
    if (isSiblingAutogroupedNode(t)) {
      return padding + `Sibling autogroup (${t.groupCount})`;
    }

    return padding + 'Autogroup';
  }
  if (isSpanNode(t)) {
    return padding + (t.value.op || t.value.span_id || 'Unknown span');
  }
  if (isTransactionNode(t)) {
    return padding + (t.value.transaction || 'Unknown transaction');
  }
  if (isMissingInstrumentationNode(t)) {
    return padding + 'Missing instrumentation';
  }
  if (isRootNode(t)) {
    return padding + 'Root';
  }
  if (isTraceNode(t)) {
    return padding + 'Trace';
  }

  if (isTraceErrorNode(t)) {
    return padding + (t.value.event_id || t.value.level) || 'Unknown trace error';
  }

  return 'Unknown node';
}
