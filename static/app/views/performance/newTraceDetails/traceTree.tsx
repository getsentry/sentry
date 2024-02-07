import type {Client} from 'sentry/api';
import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import type {Organization} from 'sentry/types';
import type {Event, EventTransaction} from 'sentry/types/event';
import type {
  TraceError as TraceErrorType,
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';

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
 * Notes:
 * - collecting children should be O(n), it is currently O(n^2) as we are missing a proper queue implementation
 * - the notion of expanded and zoomed is confusing, they stand for the same idea from a UI pov
 * - there is an annoying thing wrt span and transaction nodes where we either store data on _children or _spanChildren
 *   this is because we want to be able to store both transaction and span nodes in the same tree, but it makes for an
 *   annoying API. A better design would have been to create an invisible meta node that just points to the correct children
 * - connector generation should live in the UI layer, not in the tree. Same with depth calculation. It is more convenient
 *   to calculate this when rendering the tree, as we can only calculate it only for the visible nodes and avoid an extra tree pass
 */

export declare namespace TraceTree {
  type Transaction = TraceFullDetailed;
  type Span = RawSpanType;
  type Trace = TraceSplitResults<Transaction>;
  type TraceError = TraceErrorType;
  interface AutoGroup extends RawSpanType {
    autogroup: {
      description: string;
      op: string;
    };
  }

  type NodeValue = Trace | Transaction | Span | AutoGroup | TraceError | null;

  type Metadata = {
    event_id: string | undefined;
    project_slug: string | undefined;
  };
}

function fetchTransactionEvent(
  api: Client,
  organization: Organization,
  project_slug: string,
  event_id: string
): Promise<EventTransaction> {
  return api.requestPromise(
    `/organizations/${organization.slug}/events/${project_slug}:${event_id}/`
  );
}

export function isTransactionNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): node is TraceTreeNode<TraceTree.Transaction> {
  return !!(node.value && 'transaction' in node.value);
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
      value: TraceTree.NodeValue,
      depth: number
    ) {
      const node = new TraceTreeNode(parent, value, depth, {
        project_slug: value && 'project_slug' in value ? value.project_slug : undefined,
        event_id: value && 'event_id' in value ? value.event_id : undefined,
      });

      if (parent) {
        parent.children.push(node as TraceTreeNode<TraceTree.NodeValue>);
      }

      if (value && 'children' in value) {
        for (const child of value.children) {
          visit(node, child, depth + 1);
        }
      }

      return node;
    }

    const traceNode = new TraceTreeNode(tree.root, trace, tree.root.depth + 1, {
      event_id: undefined,
      project_slug: undefined,
    });

    // Trace is always expanded by default
    traceNode.expanded = true;
    tree.root.children.push(traceNode);

    for (const transaction of trace.transactions) {
      visit(traceNode, transaction, traceNode.depth + 1);
    }

    for (const trace_error of trace.orphan_errors) {
      visit(traceNode, trace_error, traceNode.depth + 1);
    }

    return tree.build();
  }

  static FromSpans(
    parent: TraceTreeNode<TraceTree.NodeValue>,
    spans: RawSpanType[]
  ): TraceTreeNode<TraceTree.NodeValue> {
    const parentIsSpan = !isTransactionNode(parent);
    const root = new TraceTreeNode(parent, parent.value, 0, parent.metadata);
    root.zoomedIn = true;
    const lookuptable: Record<RawSpanType['span_id'], TraceTreeNode<TraceTree.Span>> = {};

    if (parentIsSpan) {
      if (root.value && 'span_id' in root.value) {
        lookuptable[root.value.span_id] = root as TraceTreeNode<TraceTree.Span>;
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

    // !!Warning!! this mutates spans
    // @TODO this should be done by the API.
    spans.sort((a, b) => a.start_timestamp - b.start_timestamp);

    for (const span of spans) {
      const node = new TraceTreeNode(null, span, parent.depth, {
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
          parentNode.spanChildren.push(node);
          continue;
        }
      }

      // Orphaned span
      root.spanChildren.push(node);
      node.parent = root as TraceTreeNode<TraceTree.Span>;
    }

    TraceTree.AutogroupSiblingSpanNodes(root);
    return root;
  }

  get list(): ReadonlyArray<TraceTreeNode<TraceTree.NodeValue>> {
    return this._list;
  }

  static AutogroupChildrenSpanNodes(root: TraceTreeNode<TraceTree.NodeValue>): void {
    // Span chain grouping is when multiple spans with the same op are nested as direct and only children
    const queue = [root];
    let startNode: TraceTreeNode<TraceTree.Span> | null = null;
    let lastMatchingNode: TraceTreeNode<TraceTree.Span> | null = null;
    while (queue.length > 0) {
      const node = queue.pop()!;

      // End of chaining
      if (node.children.length !== 1 || isTransactionNode(node)) {
        if (lastMatchingNode && startNode && startNode.parent) {
          // Autogroup chain
          const autoGroupedNode = new TraceTreeNode<TraceTree.AutoGroup>(
            startNode.parent as TraceTreeNode<TraceTree.AutoGroup>,
            {
              ...startNode.value,
              autogroup: {
                op: startNode.value.op ?? '',
                description: startNode.value.description ?? '',
              },
            },
            startNode.depth,
            {
              event_id: undefined,
              project_slug: undefined,
            }
          );

          // @ts-expect-error ignore readonly assignment
          autoGroupedNode._children = [startNode];

          // Replace first node in chain with autogroup node
          startNode.parent.children.splice(0, 1, autoGroupedNode);
        }

        startNode = null;
        lastMatchingNode = null;

        // If there is no match, we still want to check the children
        // of the node for possible chaining
        for (const child of node.children) {
          queue.push(child);
        }
        continue;
      }

      const parent = node as TraceTreeNode<TraceTree.Span>;
      const child = node.children[0] as TraceTreeNode<TraceTree.Span>;

      if (child.children.length <= 1 && parent.value.op === child.value.op) {
        // Chain detected
        if (!startNode) {
          startNode = parent;
        }
        const grandChild = child.children[0] as TraceTreeNode<TraceTree.Span>;
        lastMatchingNode = grandChild?.value.op === child.value.op ? grandChild : child;
      }

      queue.push(child);
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
          const autoGroupedNode = new TraceTreeNode(
            node,
            {
              ...current.value,
              autogroup: {
                op: current.value.op ?? '',
                description: current.value.description ?? '',
              },
            },
            current.depth,
            {
              event_id: undefined,
              project_slug: undefined,
            }
          );

          // Copy the children under the new node.
          // @ts-expect-error ignore readonly assignment
          autoGroupedNode._children = node.children.slice(startIndex, matchCount);

          // Remove the old children from the parent and insert the new node.
          node.children.splice(startIndex, matchCount + 1, autoGroupedNode);

          // @ts-expect-error ignore readonly assignment
          for (let j = 0; j < autoGroupedNode._children.length; j++) {
            // @ts-expect-error ignore readonly assignment
            autoGroupedNode._children[j].parent = autoGroupedNode;
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

    if (node.zoomedIn) {
      // Expanding is not allowed for zoomed in nodes
      return false;
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
      fetchTransactionEvent(
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

      // Create a new tree and update the list
      const root = TraceTree.FromSpans(node, (spans?.data ?? []) as RawSpanType[]);
      node.setSpanChildren(root.spanChildren);
      node.zoomedIn = zoomedIn;
      root.depth = node.depth;
      TraceTree.updateTreeDepths(root);

      const spanChildren = node.getVisibleChildren();
      this._list.splice(index + 1, 0, ...spanChildren);
      return data;
    });

    this._spanPromises.set(node, promise);
    return promise;
  }

  static updateTreeDepths(
    node: TraceTreeNode<TraceTree.NodeValue>
  ): TraceTreeNode<TraceTree.NodeValue> {
    if (!node.children.length) {
      return node;
    }

    function visit(n: TraceTreeNode<TraceTree.NodeValue>, depth: number) {
      n.depth = depth;

      for (const child of n.children) {
        visit(child, depth + 1);
      }
    }

    for (const child of node.children) {
      visit(child, node.depth + 1);
    }

    return node;
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

export class TraceTreeNode<T> {
  parent: TraceTreeNode<T> | null = null;
  value: T;
  depth: number = 0;
  expanded: boolean = false;
  zoomedIn: boolean = false;
  canFetchData: boolean = true;
  metadata: TraceTree.Metadata = {
    project_slug: undefined,
    event_id: undefined,
  };

  private _children: TraceTreeNode<TraceTree.Transaction>[] = [];
  private _spanChildren: TraceTreeNode<TraceTree.Span>[] = [];
  private _connectors: number[] | undefined = undefined;

  constructor(
    parent: TraceTreeNode<T> | null,
    node: T,
    depth: number,
    metadata: TraceTree.Metadata
  ) {
    this.parent = parent ?? null;
    this.value = node;
    this.depth = depth;
    this.metadata = metadata;
  }

  get connectors(): number[] {
    if (this._connectors !== undefined) {
      return this._connectors!;
    }

    this._connectors = [];
    let node: TraceTreeNode<T> | null = this.parent;

    while (node) {
      if (node.value === null) {
        break;
      }

      if (node.isLastChild) {
        node = node.parent;
        continue;
      }

      this._connectors.push(node.depth * (node.isOrphaned ? -1 : 1));
      node = node.parent;
    }

    return this._connectors;
  }

  get children(): TraceTreeNode<TraceTree.NodeValue>[] {
    // if node is not a autogrouped node, return children
    // @ts-expect-error ignore primitive type
    if (this.value && 'autogroup' in this.value) {
      return this._children;
    }
    // if node is not a transaction node, return span children
    // @ts-expect-error ignore primitive type
    if (this.value && !('event_id' in this.value)) {
      return this.spanChildren;
    }
    // if a node is zoomed in, return span children, else return transaction children
    return this.zoomedIn ? this._spanChildren : this._children;
  }

  get spanChildren(): TraceTreeNode<TraceTree.Span>[] {
    return this._spanChildren;
  }

  get isOrphaned() {
    return this.parent?.value === null;
  }

  get isLastChild() {
    return this.parent?.children[this.parent.children.length - 1] === this;
  }

  setSpanChildren(children: TraceTreeNode<TraceTree.Span>[]) {
    this._spanChildren = children;
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

      if (next.expanded) {
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

    const visibleChildren: TraceTreeNode<TraceTree.NodeValue>[] = [];
    // @TODO: should be a proper FIFO queue as shift is O(n

    function visit(node) {
      visibleChildren.push(node);

      if (node.expanded) {
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
    return new TraceTreeNode(null, null, 0, {
      event_id: undefined,
      project_slug: undefined,
    });
  }
}
