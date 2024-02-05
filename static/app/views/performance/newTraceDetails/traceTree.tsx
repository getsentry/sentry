import type {Client} from 'sentry/api';
import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import type {Organization} from 'sentry/types';
import type {Event, EventTransaction} from 'sentry/types/event';
import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';

/**
 * Fetching top level trace - trasactions max(100)
 * we do not have spans for each transaction - fetch those when user clicks on a view
 * - Tree<Transaction|Span|Meta>
 *  - expandable and needs to be able to fetch its child data
 *  - can output a flattened list of nodes to render
 *
 * @DONE:
 * - implement data fetching for spans
 * - tree change commits should be optimize
 * @TODO:
 * - tree commits should have a simple API, splice is non intuitive and error prone
 * - constructing tree should be iterative
 * - implement zoom in/out swaps
 */

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

function createSpanTree(
  parent: TraceTreeNode<RawSpanType | TraceFullDetailed>,
  spans: RawSpanType[]
): TraceTreeNode<RawSpanType | TraceFullDetailed> {
  const parentIsSpan = !isTransactionNode(parent);
  const root = new TraceTreeNode(parent.value, 0, parent.metadata);
  root.zoomedIn = true;
  const lookuptable: Record<RawSpanType['span_id'], TraceTreeNode<RawSpanType>> = {};

  const childrenLinks = new Map<string, TraceTreeNodeMetadata>();
  for (const child of parent.children) {
    if (typeof child.value.parent_span_id !== 'string') {
      continue;
    }
    childrenLinks.set(child.value.parent_span_id, child.metadata);
  }

  for (const span of spans) {
    const node = new TraceTreeNode(span, parent.depth, {
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

    if (parentIsSpan) {
      root.children.push(node);
      continue;
    }

    if (span.parent_span_id) {
      if (span.parent_span_id === root.value.span_id) {
        root.children.push(node);
      }
      const parentNode = lookuptable[span.parent_span_id];
      if (parentNode) {
        parentNode.children.push(node);
      }
    }
  }

  return root;
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
      depth: number,
      index: number,
      parentChildrenLength: number
    ) {
      const node = new TraceTreeNode(value, depth, {
        project_slug: value.project_slug,
        event_id: value.event_id,
      });

      const isLastChild = parentChildrenLength < 1 || index === parentChildrenLength - 1;
      node.isLastChild = isLastChild;

      if (parent) {
        parent.children.push(node);
      }

      let indexChild = 0;
      for (const child of value.children) {
        visit(node, child, depth + 1, indexChild, value.children.length);
        indexChild++;
      }

      return node;
    }

    let index = 0;
    for (const transaction of transactions) {
      visit(tree.root, transaction, 0, index, 0);
      index++;
    }

    return tree.build();
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
      const root = createSpanTree(node, (spans?.data ?? []) as RawSpanType[]);
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

    function visit(
      n: TraceTreeNode<RawSpanType | TraceFullDetailed>,
      depth: number,
      index: number,
      parentChildrenLength: number
    ) {
      n.depth = depth;

      const isLastChild = index === parentChildrenLength - 1;
      n.isLastChild = isLastChild;

      let indexChild = 0;
      for (const child of n.children) {
        visit(child, depth + 1, indexChild, n.children.length);
        indexChild++;
      }
    }

    let index = 0;
    for (const child of node.children) {
      visit(child, node.depth + 1, index, node.children.length);
      index++;
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
  value: TreeNodeValue;
  depth: number = 0;
  expanded: boolean = false;
  zoomedIn: boolean = false;
  isLastChild: boolean = false;
  canFetchData: boolean = true;
  metadata: TraceTreeNodeMetadata = {
    project_slug: undefined,
    event_id: undefined,
  };

  private _children: TraceTreeNode<TraceFullDetailed>[] = [];
  private _spanChildren: TraceTreeNode<RawSpanType>[] = [];

  constructor(node: TreeNodeValue, depth: number, metadata: TraceTreeNodeMetadata) {
    this.value = node;
    this.depth = depth;
    this.metadata = metadata;
  }

  get children(): TraceTreeNode<TraceFullDetailed | RawSpanType>[] {
    return this.zoomedIn ? this._spanChildren : this._children;
  }

  get spanChildren(): TraceTreeNode<RawSpanType>[] {
    return this._spanChildren;
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
    const queue = [...this.children];

    while (queue.length > 0) {
      const next = queue.shift()!;

      if (next.expanded) {
        let i = next.children.length - 1;
        while (i >= 0) {
          queue.unshift(next.children[i]);
          --i;
        }
      }

      visibleChildren.push(next);
    }

    return visibleChildren;
  }

  static Root() {
    return new TraceTreeNode(null, 0, {
      event_id: undefined,
      project_slug: undefined,
    });
  }
}
