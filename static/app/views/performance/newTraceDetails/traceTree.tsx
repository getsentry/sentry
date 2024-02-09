import type {Client} from 'sentry/api';
import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import type {Organization} from 'sentry/types';
import type {Event, EventTransaction} from 'sentry/types/event';
import type {
  TraceError as TraceErrorType,
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';

import {
  isAutogroupedNode,
  isParentAutogroupedNode,
  isSpanNode,
  isTransactionNode,
} from './guards';

/**
 * Read this before proceeding:
 *
 * This file implements the tree data structure that is used to represent a trace. We do
 * this both for performance reasons as well as flexibility. The requirement for a tree
 * is to support incremental patching and updates. This is important because we want to
 * be able to fetch more data as the user interacts with the tree, and we want to be able
 * efficiently update the tree as we receive more data.
 *
 * The trace is represented as a tree with different node value types (transaction or span)
 * Each tree node contains a reference to its parent and a list of references to its children,
 * as well as a reference to the value that the node holds. Each node also contains
 * some meta data and state about the node, such as if it is expanded or zoomed in. The benefit
 * of abstracting parts of the UI state is that the tree will persist user actions such as expanding
 * or collapsing nodes which would have otherwise been lost when individual nodes are remounted in the tree.
 *
 * Each tree holds a list reference, which is a live reference to a flattened representation
 * of the tree (used to render the tree in the UI). Since the list is mutable (and we want to keep it that way for performance
 * reasons as we want to support mutations on traces with ~100k+ nodes), callers need to manage reactivity themselves.
 *
 * An alternative, but not recommended approach is to call build() on the tree after each mutation,
 * which will iterate over all of the children and build a fresh list reference.
 *
 * Notes and improvements:
 * - collecting children should be O(n), it is currently O(n^2) as we are missing a proper queue implementation
 * - the notion of expanded and zoomed is confusing, they stand for the same idea from a UI pov
 * - there is an annoying thing wrt span and transaction nodes where we either store data on _children or _spanChildren
 *   this is because we want to be able to store both transaction and span nodes in the same tree, but it makes for an
 *   annoying API. A better design would have been to create an invisible meta node that just points to the correct children
 * - connector generation should live in the UI layer, not in the tree. Same with depth calculation. It is more convenient
 *   to calculate this when rendering the tree, as we can only calculate it only for the visible nodes and avoid an extra tree pass
 * - instead of storing span children separately, we should have meta tree nodes that handle pointing to the correct children
 *
 */

export declare namespace TraceTree {
  type Transaction = TraceFullDetailed;
  type Span = RawSpanType;
  type Trace = TraceSplitResults<Transaction>;
  type TraceError = TraceErrorType;

  interface MissingInstrumentationSpan {
    start_timestamp: number;
    timestamp: number;
    type: 'missing_instrumentation';
  }
  interface SiblingAutogroup extends RawSpanType {
    autogrouped_by: {
      description: string;
      op: string;
    };
  }

  interface ChildrenAutogroup {
    autogrouped_by: {
      op: string;
    };
  }

  type NodeValue =
    | Trace
    | Transaction
    | TraceError
    | Span
    | MissingInstrumentationSpan
    | SiblingAutogroup
    | ChildrenAutogroup
    | null;

  type Metadata = {
    event_id: string | undefined;
    project_slug: string | undefined;
  };
}

function fetchTransactionSpans(
  api: Client,
  organization: Organization,
  project_slug: string,
  event_id: string
): Promise<EventTransaction> {
  return api.requestPromise(
    `/organizations/${organization.slug}/events/${project_slug}:${event_id}/`
  );
}

function maybeInsertMissingInstrumentationSpan(
  parent: TraceTreeNode<TraceTree.NodeValue>,
  node: TraceTreeNode<TraceTree.Span>
) {
  const lastInsertedSpan = parent.spanChildren[parent.spanChildren.length - 1];
  if (!lastInsertedSpan) {
    return;
  }

  if (node.value.start_timestamp - lastInsertedSpan.value.timestamp < 100) {
    return;
  }

  const missingInstrumentationSpan =
    new TraceTreeNode<TraceTree.MissingInstrumentationSpan>(
      parent,
      {
        type: 'missing_instrumentation',
        start_timestamp: lastInsertedSpan.value.timestamp,
        timestamp: node.value.start_timestamp,
      },
      {
        event_id: undefined,
        project_slug: undefined,
      }
    );

  parent.spanChildren.push(missingInstrumentationSpan);
}
export class TraceTree {
  root: TraceTreeNode<null> = TraceTreeNode.Root();
  private _spanPromises: Map<TraceTreeNode<TraceTree.NodeValue>, Promise<Event>> =
    new Map();
  private _list: TraceTreeNode<TraceTree.NodeValue>[] = [];

  static Empty() {
    return new TraceTree().build();
  }

  static FromTrace(trace: TraceTree.Trace): TraceTree {
    const tree = new TraceTree();

    function visit(
      parent: TraceTreeNode<TraceTree.NodeValue | null>,
      value: TraceTree.NodeValue
    ) {
      const node = new TraceTreeNode(parent, value, {
        project_slug: value && 'project_slug' in value ? value.project_slug : undefined,
        event_id: value && 'event_id' in value ? value.event_id : undefined,
      });
      node.canFetchData = true;

      if (parent) {
        parent.children.push(node as TraceTreeNode<TraceTree.NodeValue>);
      }

      if (value && 'children' in value) {
        for (const child of value.children) {
          visit(node, child);
        }
      }

      return node;
    }

    const traceNode = new TraceTreeNode(tree.root, trace, {
      event_id: undefined,
      project_slug: undefined,
    });

    // Trace is always expanded by default
    traceNode.expanded = true;
    tree.root.children.push(traceNode);

    for (const transaction of trace.transactions) {
      visit(traceNode, transaction);
    }

    for (const trace_error of trace.orphan_errors) {
      visit(traceNode, trace_error);
    }

    return tree.build();
  }

  static FromSpans(
    parent: TraceTreeNode<TraceTree.NodeValue>,
    spans: RawSpanType[]
  ): TraceTreeNode<TraceTree.NodeValue> {
    const parentIsSpan = isSpanNode(parent);
    const lookuptable: Record<RawSpanType['span_id'], TraceTreeNode<TraceTree.Span>> = {};

    if (parent.spanChildren.length > 0) {
      parent.zoomedIn = true;
      return parent;
    }

    if (parentIsSpan) {
      if (parent.value && 'span_id' in parent.value) {
        lookuptable[parent.value.span_id] = parent as TraceTreeNode<TraceTree.Span>;
      }
    }

    const childrenLinks = new Map<string, TraceTree.Metadata>();
    for (const child of parent.children) {
      if (
        child.value &&
        'parent_span_id' in child.value &&
        typeof child.value.parent_span_id === 'string'
      ) {
        childrenLinks.set(child.value.parent_span_id, child.metadata);
      }
      continue;
    }

    for (const span of spans) {
      const node = new TraceTreeNode(null, span, {
        event_id: undefined,
        project_slug: undefined,
      });

      const parentLinkMetadata = childrenLinks.get(span.span_id);
      node.expanded = true;
      node.canFetchData = !!parentLinkMetadata;

      if (parentLinkMetadata) {
        node.metadata = parentLinkMetadata;
      }

      lookuptable[span.span_id] = node;

      if (span.parent_span_id) {
        const parentNode = lookuptable[span.parent_span_id];

        if (parentNode) {
          node.parent = parentNode;
          maybeInsertMissingInstrumentationSpan(parentNode, node);
          parentNode.spanChildren.push(node);
          continue;
        }
      }

      // Orphaned span
      maybeInsertMissingInstrumentationSpan(parent, node);
      parent.spanChildren.push(node);
      node.parent = parent as TraceTreeNode<TraceTree.Span>;
    }

    parent.zoomedIn = true;
    TraceTree.AutogroupSiblingSpanNodes(parent);
    TraceTree.AutogroupDirectChildrenSpanNodes(parent);
    return parent;
  }

  get list(): ReadonlyArray<TraceTreeNode<TraceTree.NodeValue>> {
    return this._list;
  }

  // Span chain grouping is when multiple spans with the same op are nested as direct and only children
  // @TODO Abdk: simplify the chaining logic
  static AutogroupDirectChildrenSpanNodes(
    root: TraceTreeNode<TraceTree.NodeValue>
  ): void {
    const queue = [root];

    while (queue.length > 0) {
      const node = queue.pop()!;

      if (node.children.length > 1 || !isSpanNode(node)) {
        for (const child of node.children) {
          queue.push(child);
        }
        continue;
      }

      const head = node;
      let tail = node;
      let groupMatchCount = 0;

      while (
        tail &&
        tail.children.length === 1 &&
        isSpanNode(tail.children[0]) &&
        tail.children[0].value.op === head.value.op
      ) {
        groupMatchCount++;
        tail = tail.children[0];
      }

      if (groupMatchCount < 1) {
        for (const child of head.children) {
          queue.push(child);
        }
        continue;
      }

      const autoGroupedNode = new ParentAutogroupNode(
        node.parent,
        {
          ...head.value,
          autogrouped_by: {
            op: head.value && 'op' in head.value ? head.value.op ?? '' : '',
          },
        },
        {
          event_id: undefined,
          project_slug: undefined,
        },
        head as TraceTreeNode<TraceTree.Span>,
        tail as TraceTreeNode<TraceTree.Span>
      );

      if (!node.parent) {
        throw new Error('Parent node is missing, this should be unreachable code');
      }

      autoGroupedNode.groupCount = groupMatchCount + 1;

      for (const c of tail.children) {
        c.parent = autoGroupedNode;
      }

      const index = node.parent.children.indexOf(node);
      node.parent.children[index] = autoGroupedNode;
    }
  }

  static AutogroupSiblingSpanNodes(root: TraceTreeNode<TraceTree.NodeValue>): void {
    // Span sibling grouping is when min 5 consecutive spans without children have matching op and description
    // Span chain grouping is when multiple spans with the same op are nested as direct and only children
    const queue = [root];

    while (queue.length > 0) {
      const node = queue.pop()!;

      if (node.children.length < 5) {
        for (const child of node.children) {
          queue.push(child);
        }
        continue;
      }

      let startIndex = 0;
      let matchCount = 0;

      for (let i = 0; i < node.children.length - 1; i++) {
        const current = node.children[i] as TraceTreeNode<TraceTree.Span>;
        const next = node.children[i + 1] as TraceTreeNode<TraceTree.Span>;

        if (
          next.children.length === 0 &&
          current.children.length === 0 &&
          // @TODO this should check for typeof op and description
          // to be of type string for runtime safety. Afaik it is impossible
          // for these to be anything else but a string, but we should still check
          next.value.op === current.value.op &&
          next.value.description === current.value.description
        ) {
          matchCount++;
          if (i < node.children.length - 2) {
            continue;
          }
        }

        if (matchCount >= 4) {
          const autoGroupedNode = new SiblingAutogroupNode(
            node,
            {
              ...current.value,
              autogrouped_by: {
                op: current.value.op ?? '',
                description: current.value.description ?? '',
              },
            },
            {
              event_id: undefined,
              project_slug: undefined,
            }
          );

          // Copy the children under the new node.
          autoGroupedNode.children = node.children.slice(startIndex, matchCount + 1);
          autoGroupedNode.groupCount = matchCount + 1;

          // Remove the old children from the parent and insert the new node.
          node.children.splice(startIndex, matchCount + 1, autoGroupedNode);

          for (let j = 0; j < autoGroupedNode.children.length; j++) {
            autoGroupedNode.children[j].parent = autoGroupedNode;
          }
        }

        startIndex = i;
        matchCount = 0;
      }
    }
  }

  // Returns boolean to indicate if node was updated
  expand(node: TraceTreeNode<TraceTree.NodeValue>, expanded: boolean): boolean {
    if (expanded === node.expanded) {
      return false;
    }

    // Expanding is not allowed for zoomed in nodes
    if (node.zoomedIn) {
      return false;
    }

    if (node instanceof ParentAutogroupNode) {
      // In parent autogrouping, we perform a node swap and either point the
      // head or tails of the autogrouped sequence to the autogrouped node
      if (node.expanded) {
        const index = this._list.indexOf(node);

        const autogroupedChildren = node.getVisibleChildren();
        this._list.splice(index + 1, autogroupedChildren.length);

        const newChildren = node.tail.getVisibleChildren();

        for (const c of node.tail.children) {
          c.parent = node;
        }

        this._list.splice(index + 1, 0, ...newChildren);
      } else {
        node.head.parent = node;
        const index = this._list.indexOf(node);
        const childrenCount = node.getVisibleChildrenCount();

        this._list.splice(index + 1, childrenCount);

        node.getVisibleChildrenCount();
        const newChildren = [node.head].concat(
          node.head.getVisibleChildren() as TraceTreeNode<TraceTree.Span>[]
        );

        for (const c of node.children) {
          c.parent = node.tail;
        }

        this._list.splice(index + 1, 0, ...newChildren);
      }

      node.invalidate(node);
      node.expanded = expanded;
      return true;
    }

    if (node.expanded) {
      const index = this._list.indexOf(node);
      this._list.splice(index + 1, node.getVisibleChildrenCount());
    } else {
      const index = this._list.indexOf(node);
      this._list.splice(index + 1, 0, ...node.getVisibleChildren());
    }
    node.expanded = expanded;
    return true;
  }

  zoomIn(
    node: TraceTreeNode<TraceTree.NodeValue>,
    zoomedIn: boolean,
    options: {
      api: Client;
      organization: Organization;
    }
  ): Promise<Event | null> {
    if (zoomedIn === node.zoomedIn) {
      return Promise.resolve(null);
    }

    if (!zoomedIn) {
      const index = this._list.indexOf(node);
      const childrenCount = node.getVisibleChildrenCount();
      this._list.splice(index + 1, childrenCount);

      node.zoomedIn = zoomedIn;

      if (node.expanded) {
        this._list.splice(index + 1, 0, ...node.getVisibleChildren());
      }

      return Promise.resolve(null);
    }

    const promise =
      this._spanPromises.get(node) ??
      fetchTransactionSpans(
        options.api,
        options.organization,
        node.metadata.project_slug!,
        node.metadata.event_id!
      );

    promise.then(data => {
      const spans = data.entries.find(s => s.type === 'spans');
      if (!spans) {
        return data;
      }

      // Remove existing entries from the list
      const index = this._list.indexOf(node);
      if (node.expanded) {
        const childrenCount = node.getVisibleChildrenCount();
        this._list.splice(index + 1, childrenCount);
      }

      // Api response is not sorted
      if (spans.data) {
        spans.data.sort((a, b) => a.start_timestamp - b.start_timestamp);
      }

      TraceTree.FromSpans(node, spans.data);

      const spanChildren = node.getVisibleChildren();
      this._list.splice(index + 1, 0, ...spanChildren);
      return data;
    });

    this._spanPromises.set(node, promise);
    return promise;
  }

  toList(): TraceTreeNode<TraceTree.NodeValue>[] {
    const list: TraceTreeNode<TraceTree.NodeValue>[] = [];

    function visit(node: TraceTreeNode<TraceTree.NodeValue>) {
      list.push(node);

      if (!node.expanded) {
        return;
      }

      for (const child of node.children) {
        visit(child);
      }
    }

    for (const child of this.root.children) {
      visit(child);
    }

    return list;
  }

  build() {
    this._list = this.toList();
    return this;
  }
}

export class TraceTreeNode<T extends TraceTree.NodeValue> {
  parent: TraceTreeNode<TraceTree.NodeValue> | null = null;
  value: T;
  expanded: boolean = false;
  zoomedIn: boolean = false;
  canFetchData: boolean = false;
  metadata: TraceTree.Metadata = {
    project_slug: undefined,
    event_id: undefined,
  };

  private _depth: number | undefined;
  private _children: TraceTreeNode<TraceTree.NodeValue>[] = [];
  private _spanChildren: TraceTreeNode<
    TraceTree.Span | TraceTree.MissingInstrumentationSpan
  >[] = [];
  private _connectors: number[] | undefined = undefined;

  constructor(
    parent: TraceTreeNode<TraceTree.NodeValue> | null,
    value: T,
    metadata: TraceTree.Metadata
  ) {
    this.parent = parent ?? null;
    this.value = value;
    this.metadata = metadata;

    if (isTransactionNode(this)) {
      this.expanded = true;
    }
  }

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

  set depth(depth: number) {
    this._depth = depth;
  }

  get connectors(): number[] {
    if (this._connectors !== undefined) {
      return this._connectors!;
    }

    this._connectors = [];

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

  get children(): TraceTreeNode<TraceTree.NodeValue>[] {
    // if node is not a autogrouped node, return children
    if (isAutogroupedNode(this)) {
      return this._children;
    }

    if (isSpanNode(this)) {
      return this.canFetchData && !this.zoomedIn ? [] : this.spanChildren;
    }

    // if a node is zoomed in, return span children, else return transaction children
    return this.zoomedIn ? this._spanChildren : this._children;
  }

  set children(children: TraceTreeNode<TraceTree.NodeValue>[]) {
    this._children = children;
  }

  get spanChildren(): TraceTreeNode<
    TraceTree.Span | TraceTree.MissingInstrumentationSpan
  >[] {
    return this._spanChildren;
  }

  get isOrphaned() {
    return this.parent?.value && 'orphan_errors' in this.parent.value;
  }

  get isLastChild() {
    return this.parent?.children[this.parent.children.length - 1] === this;
  }

  invalidate(root?: TraceTreeNode<TraceTree.NodeValue>) {
    this._connectors = undefined;
    this._depth = undefined;

    if (root) {
      const queue = [...this.children];

      while (queue.length > 0) {
        const next = queue.pop()!;
        next.invalidate();
        for (let i = 0; i < next.children.length; i++) {
          queue.push(next.children[i]);
        }
      }
    }
  }

  getVisibleChildrenCount(): number {
    if (!this.children.length) {
      return 0;
    }

    let count = 0;
    const queue = [...this.children];

    while (queue.length > 0) {
      count++;
      const next = queue.pop()!;

      if (next.expanded || isParentAutogroupedNode(next)) {
        for (let i = 0; i < next.children.length; i++) {
          queue.push(next.children[i]);
        }
      }
    }

    return count;
  }

  getVisibleChildren(): TraceTreeNode<TraceTree.NodeValue>[] {
    if (!this.children.length) {
      return [];
    }

    // @TODO: should be a proper FIFO queue as shift is O(n)
    const visibleChildren: TraceTreeNode<TraceTree.NodeValue>[] = [];

    function visit(node) {
      visibleChildren.push(node);

      if (node.expanded || isParentAutogroupedNode(node)) {
        for (let i = 0; i < node.children.length; i++) {
          visit(node.children[i]);
        }
      }
    }

    for (const child of this.children) {
      visit(child);
    }

    return visibleChildren;
  }

  static Root() {
    return new TraceTreeNode(null, null, {
      event_id: undefined,
      project_slug: undefined,
    });
  }
}

export class ParentAutogroupNode extends TraceTreeNode<TraceTree.ChildrenAutogroup> {
  head: TraceTreeNode<TraceTree.Span>;
  tail: TraceTreeNode<TraceTree.Span>;
  groupCount: number = 0;

  constructor(
    parent: TraceTreeNode<TraceTree.NodeValue> | null,
    node: TraceTree.ChildrenAutogroup,
    metadata: TraceTree.Metadata,
    head: TraceTreeNode<TraceTree.Span>,
    tail: TraceTreeNode<TraceTree.Span>
  ) {
    super(parent, node, metadata);

    this.head = head;
    this.tail = tail;
  }

  get children() {
    if (this.expanded) {
      return [this.head];
    }
    return this.tail.children;
  }
}

export class SiblingAutogroupNode extends TraceTreeNode<TraceTree.SiblingAutogroup> {
  groupCount: number = 0;

  constructor(
    parent: TraceTreeNode<TraceTree.NodeValue> | null,
    node: TraceTree.SiblingAutogroup,
    metadata: TraceTree.Metadata
  ) {
    super(parent, node, metadata);
  }
}
