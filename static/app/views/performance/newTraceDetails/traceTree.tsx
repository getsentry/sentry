import type {Client} from 'sentry/api';
import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import type {Organization} from 'sentry/types';
import type {Event, EventTransaction} from 'sentry/types/event';
import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';

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
 */

// Connectors todo
// - last span child shouldnt dispay a connector below itself
// - first child does not have a full vertical connector

export type Transaction = TraceFullDetailed;
export type TraceTreeNodeMetadata = {
  event_id: string | undefined;
  project_slug: string | undefined;
};

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
  node: TraceTreeNode<TraceFullDetailed | RawSpanType>
): node is TraceTreeNode<TraceFullDetailed> {
  return !!(node.value && 'transaction' in node.value);
}

export class TraceTree {
  root: TraceTreeNode<null> = TraceTreeNode.Root();
  private _spanPromises: Map<
    TraceTreeNode<TraceFullDetailed | RawSpanType>,
    Promise<Event>
  > = new Map();
  private _list: TraceTreeNode<TraceFullDetailed | RawSpanType>[] = [];

  static Empty() {
    return new TraceTree().build();
  }

  static FromTrace(transactions: Transaction[]): TraceTree {
    const tree = new TraceTree();

    function visit(
      parent: TraceTreeNode<TraceFullDetailed | RawSpanType | null>,
      value: TraceFullDetailed,
      depth: number
    ) {
      const node = new TraceTreeNode(parent, value, depth, {
        project_slug: value.project_slug,
        event_id: value.event_id,
      });

      if (parent) {
        parent.children.push(node as TraceTreeNode<TraceFullDetailed | RawSpanType>);
      }

      for (const child of value.children) {
        visit(node, child, depth + 1);
      }

      return node;
    }

    for (const transaction of transactions) {
      visit(tree.root, transaction, 0);
    }

    return tree.build();
  }

  static FromSpans(
    parent: TraceTreeNode<RawSpanType | TraceFullDetailed>,
    spans: RawSpanType[]
  ): TraceTreeNode<RawSpanType | TraceFullDetailed> {
    const parentIsSpan = !isTransactionNode(parent);
    const root = new TraceTreeNode(parent, parent.value, 0, parent.metadata);
    root.zoomedIn = true;
    const lookuptable: Record<RawSpanType['span_id'], TraceTreeNode<RawSpanType>> = {};

    if (parentIsSpan) {
      lookuptable[root.value.span_id] = root as TraceTreeNode<RawSpanType>;
    }

    const childrenLinks = new Map<string, TraceTreeNodeMetadata>();
    for (const child of parent.children) {
      if (typeof child.value.parent_span_id !== 'string') {
        continue;
      }
      childrenLinks.set(child.value.parent_span_id, child.metadata);
    }

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
      node.parent = root as TraceTreeNode<RawSpanType>;
    }

    return root;
  }

  get list(): ReadonlyArray<TraceTreeNode<TraceFullDetailed | RawSpanType>> {
    return this._list;
  }

  // Returns boolean to indicate if node was updated
  expand(
    node: TraceTreeNode<TraceFullDetailed | RawSpanType>,
    expanded: boolean
  ): boolean {
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
    node: TraceTreeNode<TraceFullDetailed | RawSpanType>,
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
    node: TraceTreeNode<RawSpanType | TraceFullDetailed>
  ): TraceTreeNode<RawSpanType | TraceFullDetailed> {
    if (!node.children.length) {
      return node;
    }

    function visit(n: TraceTreeNode<RawSpanType | TraceFullDetailed>, depth: number) {
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

  toList(): TraceTreeNode<TraceFullDetailed | RawSpanType>[] {
    const list: TraceTreeNode<TraceFullDetailed | RawSpanType>[] = [];

    function visit(node: TraceTreeNode<TraceFullDetailed | RawSpanType>) {
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

export class TraceTreeNode<TreeNodeValue> {
  parent: TraceTreeNode<TreeNodeValue> | null = null;
  value: TreeNodeValue;
  depth: number = 0;
  expanded: boolean = false;
  zoomedIn: boolean = false;
  canFetchData: boolean = true;
  metadata: TraceTreeNodeMetadata = {
    project_slug: undefined,
    event_id: undefined,
  };

  private _children: TraceTreeNode<TraceFullDetailed>[] = [];
  private _spanChildren: TraceTreeNode<RawSpanType>[] = [];
  private _connectors: number[] | undefined = undefined;

  constructor(
    parent: TraceTreeNode<TreeNodeValue> | null,
    node: TreeNodeValue,
    depth: number,
    metadata: TraceTreeNodeMetadata
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
    let node: TraceTreeNode<TreeNodeValue> | null = this.parent;

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

  get children(): TraceTreeNode<TraceFullDetailed | RawSpanType>[] {
    // if node is not a transaction node, return span children
    if (this.value && !('event_id' in this.value)) {
      return this.spanChildren;
    }
    return this.zoomedIn ? this._spanChildren : this._children;
  }

  get spanChildren(): TraceTreeNode<RawSpanType>[] {
    return this._spanChildren;
  }

  get isOrphaned() {
    return this.parent?.value === null;
  }

  get isLastChild() {
    return this.parent?.children[this.parent.children.length - 1] === this;
  }

  setSpanChildren(children: TraceTreeNode<RawSpanType>[]) {
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

  getVisibleChildren(): TraceTreeNode<RawSpanType | TraceFullDetailed>[] {
    if (!this.children.length) {
      return [];
    }

    const visibleChildren: TraceTreeNode<RawSpanType | TraceFullDetailed>[] = [];
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
