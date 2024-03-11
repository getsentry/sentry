import type {Client} from 'sentry/api';
import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import type {Organization} from 'sentry/types';
import type {Event, EventTransaction, Measurement} from 'sentry/types/event';
import type {
  TraceError as TraceErrorType,
  TraceErrorOrIssue,
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {isTraceError} from 'sentry/utils/performance/quickTrace/utils';

import {TraceType} from '../traceDetails/newTraceDetailsContent';
import {isRootTransaction} from '../traceDetails/utils';

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
  shouldAddMissingInstrumentationSpan,
} from './guards';

/**
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
 * In most cases, the initial tree is a list of transactions containing other transactions. Each transaction can
 * then be expanded into a list of spans which can also in some cases be expanded.
 *
 *  - trace                                          - trace
 *   |- parent transaction     --> when expanding     |- parent transaction
 *    |- child transaction                             |- span
 *                                                      |- span                     this used to be a transaction,
 *                                                     |- child transaction span <- but is now be a list of spans
 *                                                     |- span                      belonging to the transaction
 *                                                                                  this results in child txns to be lost,
 *                                                                                  which is a confusing user experience
 *
 * The tree supports autogrouping of spans vertically or as siblings. When that happens, a autogrouped node of either a vertical or
 * sibling type is inserted as an intermediary node. In the vertical case, the autogrouped node
 * holds the reference to the head and tail of the autogrouped sequence. In the sibling case, the autogrouped node
 * holds a reference to the children that are part of the autogrouped sequence. When expanding and collapsing these nodes,
 * the tree perform a reference swap to either point to the head (when expanded) or tail (when collapsed) of the autogrouped sequence.
 *
 * In vertical grouping case, the following happens:
 *
 * - root                                              - root
 *  - trace                                             - trace
 *  |- transaction                                       |- transaction
 *   |- span 1   <-|  these become autogrouped             |- autogrouped (head=span1, tail=span3, children points to children of tail)
 *    |- span 2    |- as they are inserted into             |- other span (parent points to autogrouped node)
 *     |- span 3 <-|  the tree.
 *      |- other span
 *
 * When the autogrouped node is expanded the UI needs to show the entire collapsed chain, so we swap the tail children to point
 * back to the tail, and have autogrouped node point to it's head as the children.
 *
 * - root                                                             - root
 *  - trace                                                            - trace
 *  |- transaction                                                     |- transaction
 *   |- autogrouped (head=span1, tail=span3) <- when expanding          |- autogrouped (head=span1, tail=span3, children points to head)
 *    | other span (paren points to autogrouped)                         |- span 1 (head)
 *                                                                        |- span 2
 *                                                                         |- span 3 (tail)
 *                                                                          |- other span (children of tail, parent points to tail)
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
 */

export declare namespace TraceTree {
  type Transaction = TraceFullDetailed;
  type Span = RawSpanType & {
    childTxn: Transaction | undefined;
    event: EventTransaction;
    relatedErrors: TraceErrorOrIssue[];
  };
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

  interface ChildrenAutogroup extends RawSpanType {
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

  type NodePath = `${'txn' | 'span' | 'ag' | 'trace' | 'ms' | 'error'}:${string}`;

  type Metadata = {
    event_id: string | undefined;
    project_slug: string | undefined;
  };

  type Indicator = {
    duration: number;
    label: string;
    measurement: Measurement;
    start: number;
    type: 'cls' | 'fcp' | 'fp' | 'lcp' | 'ttfb';
  };
}

function cacheKey(organization: Organization, project_slug: string, event_id: string) {
  return organization.slug + ':' + project_slug + ':' + event_id;
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

function measurementToTimestamp(
  start_timestamp: number,
  measurement: number,
  unit: string
) {
  if (unit === 'second') {
    return start_timestamp + measurement;
  }
  if (unit === 'millisecond') {
    return start_timestamp + measurement / 1e3;
  }
  if (unit === 'nanosecond') {
    return start_timestamp + measurement / 1e9;
  }
  throw new TypeError(`Unsupported measurement unit', ${unit}`);
}

function maybeInsertMissingInstrumentationSpan(
  parent: TraceTreeNode<TraceTree.NodeValue>,
  node: TraceTreeNode<TraceTree.Span>
) {
  const previousSpan = parent.spanChildren[parent.spanChildren.length - 1];
  if (!previousSpan || !isSpanNode(previousSpan)) {
    return;
  }

  if (node.value.start_timestamp - previousSpan.value.timestamp < 0.1) {
    return;
  }

  const missingInstrumentationSpan = new MissingInstrumentationNode(
    parent,
    {
      type: 'missing_instrumentation',
      start_timestamp: previousSpan.value.timestamp,
      timestamp: node.value.start_timestamp,
    },
    {
      event_id: undefined,
      project_slug: undefined,
    },
    previousSpan,
    node
  );

  parent.spanChildren.push(missingInstrumentationSpan);
}

// cls is not included as it is a cumulative layout shift and not a single point in time
const RENDERABLE_MEASUREMENTS = ['fcp', 'fp', 'lcp', 'ttfb'];
export class TraceTree {
  type: 'loading' | 'empty' | 'trace' = 'trace';
  root: TraceTreeNode<null> = TraceTreeNode.Root();
  indicators: TraceTree.Indicator[] = [];

  private _spanPromises: Map<string, Promise<Event>> = new Map();
  private _list: TraceTreeNode<TraceTree.NodeValue>[] = [];

  static Empty() {
    const tree = new TraceTree().build();
    tree.type = 'empty';
    return tree;
  }

  static Loading(metadata: TraceTree.Metadata): TraceTree {
    const tree = makeExampleTrace(metadata);
    tree.type = 'loading';
    return tree;
  }

  static FromTrace(trace: TraceTree.Trace, event?: EventTransaction): TraceTree {
    const tree = new TraceTree();
    let traceStart = Number.POSITIVE_INFINITY;
    let traceEnd = Number.NEGATIVE_INFINITY;

    function visit(
      parent: TraceTreeNode<TraceTree.NodeValue | null>,
      value: TraceTree.Transaction | TraceTree.TraceError
    ) {
      const node = new TraceTreeNode(parent, value, {
        project_slug: value && 'project_slug' in value ? value.project_slug : undefined,
        event_id: value && 'event_id' in value ? value.event_id : undefined,
      });
      node.canFetch = true;

      if (parent) {
        parent.children.push(node as TraceTreeNode<TraceTree.NodeValue>);
      }

      if ('start_timestamp' in value && value.start_timestamp < traceStart) {
        traceStart = value.start_timestamp;
      }
      if ('timestamp' in value && typeof value.timestamp === 'number') {
        // Errors don't have 'start_timestamp', so we adjust traceStart
        // with an errors 'timestamp'
        if (isTraceError(value)) {
          traceStart = Math.min(value.timestamp, traceStart);
        }

        traceEnd = Math.max(value.timestamp, traceEnd);
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
    tree.root.children.push(traceNode);

    for (const transaction of trace.transactions) {
      visit(traceNode, transaction);
    }

    for (const trace_error of trace.orphan_errors) {
      visit(traceNode, trace_error);
    }

    if (event?.measurements) {
      const indicators = tree
        .collectMeasurements(traceStart, event.measurements)
        .sort((a, b) => a.start - b.start);

      for (const indicator of indicators) {
        if (indicator.start > traceEnd) {
          traceEnd = indicator.start;
        }

        indicator.start *= traceNode.multiplier;
      }

      tree.indicators = indicators;
    }

    traceNode.space = [
      traceStart * traceNode.multiplier,
      (traceEnd - traceStart) * traceNode.multiplier,
    ];

    tree.root.space = [
      traceStart * traceNode.multiplier,
      (traceEnd - traceStart) * traceNode.multiplier,
    ];

    return tree.build();
  }

  static GetTraceType(root: TraceTreeNode<null>): TraceType {
    const trace = root.children[0];
    if (!trace || !isTraceNode(trace)) {
      throw new TypeError('Not trace node');
    }

    const {transactions, orphan_errors} = trace.value;
    const {roots, orphans} = (transactions ?? []).reduce(
      (counts, transaction) => {
        if (isRootTransaction(transaction)) {
          counts.roots++;
        } else {
          counts.orphans++;
        }
        return counts;
      },
      {roots: 0, orphans: 0}
    );

    if (roots === 0) {
      if (orphans > 0) {
        return TraceType.NO_ROOT;
      }

      if (orphan_errors && orphan_errors.length > 0) {
        return TraceType.ONLY_ERRORS;
      }

      return TraceType.EMPTY_TRACE;
    }

    if (roots === 1) {
      if (orphans > 0) {
        return TraceType.BROKEN_SUBTRACES;
      }

      return TraceType.ONE_ROOT;
    }

    if (roots > 1) {
      return TraceType.MULTIPLE_ROOTS;
    }

    throw new Error('Unknown trace type');
  }

  static FromSpans(
    parent: TraceTreeNode<TraceTree.NodeValue>,
    data: Event,
    spans: RawSpanType[],
    options: {sdk: string | undefined} | undefined
  ): TraceTreeNode<TraceTree.NodeValue> {
    parent.invalidate(parent);
    const platformHasMissingSpans = shouldAddMissingInstrumentationSpan(options?.sdk);

    const parentIsSpan = isSpanNode(parent);
    const lookuptable: Record<
      RawSpanType['span_id'],
      TraceTreeNode<TraceTree.Span | TraceTree.Transaction>
    > = {};

    if (parent.spanChildren.length > 0) {
      parent.zoomedIn = true;
      return parent;
    }

    if (parentIsSpan) {
      if (parent.value && 'span_id' in parent.value) {
        lookuptable[parent.value.span_id] = parent as TraceTreeNode<TraceTree.Span>;
      }
    }

    const transactionsToSpanMap = new Map<string, TraceTreeNode<TraceTree.Transaction>>();

    for (const child of parent.children) {
      if (
        isTransactionNode(child) &&
        'parent_span_id' in child.value &&
        typeof child.value.parent_span_id === 'string'
      ) {
        transactionsToSpanMap.set(child.value.parent_span_id, child);
      }
      continue;
    }

    for (const span of spans) {
      const childTxn = transactionsToSpanMap.get(span.span_id);
      const spanNodeValue: TraceTree.Span = {
        ...span,
        event: data as EventTransaction,
        relatedErrors: childTxn
          ? getSpanErrorsOrIssuesFromTransaction(span, childTxn.value)
          : [],
        childTxn: childTxn?.value,
      };
      const node: TraceTreeNode<TraceTree.Span> = new TraceTreeNode(null, spanNodeValue, {
        event_id: undefined,
        project_slug: undefined,
      });

      // This is the case where the current span is the parent of a txn at the
      // trace level. When zooming into the parent of the txn, we want to place a copy
      // of the txn as a child of the parenting span.
      if (childTxn) {
        const clonedChildTxn =
          childTxn.cloneDeep() as unknown as TraceTreeNode<TraceTree.Span>;

        node.spanChildren.push(clonedChildTxn);
        clonedChildTxn.parent = node;
      }

      lookuptable[span.span_id] = node;

      if (span.parent_span_id) {
        const spanParentNode = lookuptable[span.parent_span_id];

        if (spanParentNode) {
          node.parent = spanParentNode;
          if (platformHasMissingSpans) {
            maybeInsertMissingInstrumentationSpan(spanParentNode, node);
          }
          spanParentNode.spanChildren.push(node);
          continue;
        }
      }

      if (platformHasMissingSpans) {
        maybeInsertMissingInstrumentationSpan(parent, node);
      }
      parent.spanChildren.push(node);
      node.parent = parent;
    }

    parent.zoomedIn = true;
    TraceTree.AutogroupSiblingSpanNodes(parent);
    TraceTree.AutogroupDirectChildrenSpanNodes(parent);
    return parent;
  }

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
      const erroredChildren: TraceTreeNode<TraceTree.NodeValue>[] = [];

      while (
        tail &&
        tail.children.length === 1 &&
        isSpanNode(tail.children[0]) &&
        tail.children[0].value.op === head.value.op
      ) {
        if (tail.value?.relatedErrors.length > 0) {
          erroredChildren.push(tail);
        }

        groupMatchCount++;
        tail = tail.children[0];
      }

      // Checking the tail node for errors as it is not included in the grouping
      // while loop, but is hidden when the autogrouped node is collapsed
      if (tail.value?.relatedErrors.length > 0) {
        erroredChildren.push(tail);
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
        head,
        tail
      );

      if (!node.parent) {
        throw new Error('Parent node is missing, this should be unreachable code');
      }

      autoGroupedNode.groupCount = groupMatchCount + 1;
      autoGroupedNode.errored_children = erroredChildren;
      autoGroupedNode.space = [
        Math.min(head.value.start_timestamp, tail.value.timestamp) *
          autoGroupedNode.multiplier,
        Math.max(
          tail.value.timestamp - head.value.start_timestamp,
          head.value.timestamp - tail.value.timestamp
        ) * autoGroupedNode.multiplier,
      ];

      for (const c of tail.children) {
        c.parent = autoGroupedNode;
        queue.push(c);
      }

      const index = node.parent.children.indexOf(node);
      node.parent.children[index] = autoGroupedNode;
    }
  }

  static AutogroupSiblingSpanNodes(root: TraceTreeNode<TraceTree.NodeValue>): void {
    const queue = [root];

    while (queue.length > 0) {
      const node = queue.pop()!;

      if (node.children.length < 5) {
        for (const child of node.children) {
          queue.push(child);
        }
        continue;
      }

      let index = 0;
      let matchCount = 0;
      while (index < node.children.length) {
        const current = node.children[index] as TraceTreeNode<TraceTree.Span>;
        const next = node.children[index + 1] as TraceTreeNode<TraceTree.Span>;

        if (
          next &&
          next.children.length === 0 &&
          current.children.length === 0 &&
          next.value.op === current.value.op &&
          next.value.description === current.value.description
        ) {
          matchCount++;
          // If the next node is the last node in the list, we keep iterating
          if (index + 1 < node.children.length) {
            index++;
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

          autoGroupedNode.groupCount = matchCount + 1;
          const start = index - matchCount;
          let start_timestamp = Number.MAX_SAFE_INTEGER;
          let timestamp = Number.MIN_SAFE_INTEGER;

          for (let j = start; j < start + matchCount + 1; j++) {
            const child = node.children[j];
            if (
              child.value &&
              'timestamp' in child.value &&
              typeof child.value.timestamp === 'number' &&
              child.value.timestamp > timestamp
            ) {
              timestamp = child.value.timestamp;
            }

            if (
              child.value &&
              'start_timestamp' in child.value &&
              typeof child.value.start_timestamp === 'number' &&
              child.value.start_timestamp > start_timestamp
            ) {
              start_timestamp = child.value.start_timestamp;
            }

            if (!isSpanNode(child)) {
              throw new TypeError(
                'Expected child of autogrouped node to be a span node.'
              );
            }

            if (child.value?.relatedErrors.length > 0) {
              autoGroupedNode.errored_children.push(child);
            }

            autoGroupedNode.children.push(node.children[j]);
            autoGroupedNode.children[autoGroupedNode.children.length - 1].parent =
              autoGroupedNode;
          }

          autoGroupedNode.space = [
            start_timestamp * autoGroupedNode.multiplier,
            (timestamp - start_timestamp) * autoGroupedNode.multiplier,
          ];

          node.children.splice(start, matchCount + 1, autoGroupedNode);
          index = start + 1;
          matchCount = 0;
        } else {
          index++;
          matchCount = 0;
        }
      }
    }
  }

  collectMeasurements(
    start_timestamp: number,
    measurements: Record<string, Measurement>
  ): TraceTree.Indicator[] {
    const indicators: TraceTree.Indicator[] = [];

    for (const measurement of RENDERABLE_MEASUREMENTS) {
      const value = measurements[measurement];
      if (!value) {
        continue;
      }

      const timestamp = measurementToTimestamp(
        start_timestamp,
        value.value,
        value.unit ?? 'milliseconds'
      );

      indicators.push({
        start: timestamp,
        duration: 0,
        measurement: value,
        type: measurement as TraceTree.Indicator['type'],
        label: measurement.toUpperCase(),
      });
    }

    return indicators;
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
      // Flip expanded after collecting visible children
      node.expanded = expanded;
    } else {
      const index = this._list.indexOf(node);
      // Flip expanded so that we can collect visible children
      node.expanded = expanded;
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
      node.invalidate(node);

      if (node.expanded) {
        this._list.splice(index + 1, 0, ...node.getVisibleChildren());
      }

      return Promise.resolve(null);
    }

    const key = cacheKey(
      options.organization,
      node.metadata.project_slug!,
      node.metadata.event_id!
    );
    const promise =
      this._spanPromises.get(key) ??
      fetchTransactionSpans(
        options.api,
        options.organization,
        node.metadata.project_slug!,
        node.metadata.event_id!
      );

    node.fetchStatus = 'loading';

    promise
      .then(data => {
        node.fetchStatus = 'resolved';

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

        TraceTree.FromSpans(node, data, spans.data, {sdk: data.sdk?.name});

        const spanChildren = node.getVisibleChildren();
        this._list.splice(index + 1, 0, ...spanChildren);
        return data;
      })
      .catch(_e => {
        node.fetchStatus = 'error';
      });

    this._spanPromises.set(key, promise);
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

  get list(): ReadonlyArray<TraceTreeNode<TraceTree.NodeValue>> {
    return this._list;
  }

  /**
   * Prints the tree in a human readable format, useful for debugging and testing
   */
  print() {
    // root nodes are -1 indexed, so we add 1 to the depth so .repeat doesnt throw
    const print = this.list
      .map(t => printNode(t, 0))
      .filter(Boolean)
      .join('\n');

    // eslint-disable-next-line no-console
    console.log(print);
  }

  build() {
    this._list = this.toList();
    return this;
  }
}

export class TraceTreeNode<T extends TraceTree.NodeValue> {
  canFetch: boolean = false;
  fetchStatus: 'resolved' | 'error' | 'idle' | 'loading' = 'idle';
  parent: TraceTreeNode<TraceTree.NodeValue> | null = null;
  value: T;
  expanded: boolean = false;
  zoomedIn: boolean = false;
  metadata: TraceTree.Metadata = {
    project_slug: undefined,
    event_id: undefined,
  };

  space: [number, number] | null = null;

  multiplier: number;
  private unit: 'milliseconds' = 'milliseconds';

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
    this.multiplier = this.unit === 'milliseconds' ? 1e3 : 1;

    if (value && 'timestamp' in value && 'start_timestamp' in value) {
      this.space = [
        value.start_timestamp * this.multiplier,
        (value.timestamp - value.start_timestamp) * this.multiplier,
      ];
    }

    if (
      isTraceErrorNode(this) &&
      'timestamp' in this.value &&
      typeof this.value.timestamp === 'number'
    ) {
      this.space = [this.value.timestamp * this.multiplier, 0];
    }

    if (isTransactionNode(this) || isTraceNode(this) || isSpanNode(this)) {
      this.expanded = true;
    }
  }

  cloneDeep(): TraceTreeNode<T> | ParentAutogroupNode | SiblingAutogroupNode {
    let node: TraceTreeNode<T> | ParentAutogroupNode | SiblingAutogroupNode;

    if (isParentAutogroupedNode(this)) {
      node = new ParentAutogroupNode(
        this.parent,
        this.value,
        this.metadata,
        this.head,
        this.tail
      );
      node.groupCount = this.groupCount;
    } else {
      node = new TraceTreeNode(this.parent, this.value, this.metadata);
    }

    if (!node) {
      throw new Error('CloneDeep is not implemented');
    }

    node.expanded = this.expanded;
    node.zoomedIn = this.zoomedIn;
    node.canFetch = this.canFetch;
    node.space = this.space;
    node.metadata = this.metadata;

    if (isParentAutogroupedNode(node)) {
      node.head = node.head.cloneDeep() as TraceTreeNode<TraceTree.Span>;
      node.tail = node.tail.cloneDeep() as TraceTreeNode<TraceTree.Span>;

      for (const child of node.head.children) {
        child.parent = node;
      }

      for (const child of node.tail.children) {
        child.parent = node;
      }

      node.head.parent = node;
      node.tail.parent = node;
    } else {
      for (const child of this.children) {
        const childClone = child.cloneDeep() as TraceTreeNode<TraceTree.Span>;
        node.children.push(childClone);
        childClone.parent = node;
      }
    }

    return node;
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
  get children(): TraceTreeNode<TraceTree.NodeValue>[] {
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

  set children(children: TraceTreeNode<TraceTree.NodeValue>[]) {
    this._children = children;
  }

  get spanChildren(): TraceTreeNode<
    TraceTree.Span | TraceTree.MissingInstrumentationSpan
  >[] {
    return this._spanChildren;
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
    const stack: TraceTreeNode<TraceTree.NodeValue>[] = [];
    let count = 0;

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
      count++;
      // Since we're using a stack and it's LIFO, reverse the children before pushing them
      // to ensure they are processed in the original left-to-right order.
      if (node.expanded || isParentAutogroupedNode(node)) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
      }
    }

    return count;
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
      // Since we're using a stack and it's LIFO, reverse the children before pushing them
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
      .map(t => printNode(t, offset))
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

      if (predicate(next)) return next;

      for (const child of next.children) {
        queue.push(child);
      }
    }

    return null;
  }

  static Root() {
    return new TraceTreeNode(null, null, {
      event_id: undefined,
      project_slug: undefined,
    });
  }
}

export class MissingInstrumentationNode extends TraceTreeNode<TraceTree.MissingInstrumentationSpan> {
  next: TraceTreeNode<TraceTree.Span>;
  previous: TraceTreeNode<TraceTree.Span>;

  constructor(
    parent: TraceTreeNode<TraceTree.NodeValue>,
    node: TraceTree.MissingInstrumentationSpan,
    metadata: TraceTree.Metadata,
    previous: TraceTreeNode<TraceTree.Span>,
    next: TraceTreeNode<TraceTree.Span>
  ) {
    super(parent, node, metadata);

    this.next = next;
    this.previous = previous;
  }
}

export class ParentAutogroupNode extends TraceTreeNode<TraceTree.ChildrenAutogroup> {
  head: TraceTreeNode<TraceTree.Span>;
  tail: TraceTreeNode<TraceTree.Span>;
  errored_children: TraceTreeNode<TraceTree.NodeValue>[] = [];
  groupCount: number = 0;

  private _autogroupedSegments: [number, number][] | undefined;

  constructor(
    parent: TraceTreeNode<TraceTree.NodeValue> | null,
    node: TraceTree.ChildrenAutogroup,
    metadata: TraceTree.Metadata,
    head: TraceTreeNode<TraceTree.Span>,
    tail: TraceTreeNode<TraceTree.Span>
  ) {
    super(parent, node, metadata);

    this.expanded = false;
    this.head = head;
    this.tail = tail;
  }

  get children() {
    if (this.expanded) {
      return [this.head];
    }
    return this.tail.children;
  }

  get has_error(): boolean {
    return this.errored_children.length > 0;
  }

  get autogroupedSegments(): [number, number][] {
    if (this._autogroupedSegments) {
      return this._autogroupedSegments;
    }

    const children: TraceTreeNode<TraceTree.NodeValue>[] = [];
    let start: TraceTreeNode<TraceTree.NodeValue> | undefined = this.head;

    while (start && start !== this.tail) {
      children.push(start);
      start = start.children[0];
    }

    children.push(this.tail);

    this._autogroupedSegments = computeAutogroupedBarSegments(children);
    return this._autogroupedSegments;
  }
}

export class SiblingAutogroupNode extends TraceTreeNode<TraceTree.SiblingAutogroup> {
  groupCount: number = 0;
  errored_children: TraceTreeNode<TraceTree.NodeValue>[] = [];
  private _autogroupedSegments: [number, number][] | undefined;

  constructor(
    parent: TraceTreeNode<TraceTree.NodeValue> | null,
    node: TraceTree.SiblingAutogroup,
    metadata: TraceTree.Metadata
  ) {
    super(parent, node, metadata);
    this.expanded = false;
  }

  get has_error(): boolean {
    return this.errored_children.length > 0;
  }

  get autogroupedSegments(): [number, number][] {
    if (this._autogroupedSegments) {
      return this._autogroupedSegments;
    }

    this._autogroupedSegments = computeAutogroupedBarSegments(this.children);
    return this._autogroupedSegments;
  }
}

function partialTransaction(
  partial: Partial<TraceTree.Transaction>
): TraceTree.Transaction {
  return {
    start_timestamp: 0,
    timestamp: 0,
    errors: [],
    performance_issues: [],
    parent_span_id: '',
    span_id: '',
    parent_event_id: '',
    project_id: 0,
    'transaction.duration': 0,
    'transaction.op': 'db',
    'transaction.status': 'ok',
    generation: 0,
    project_slug: '',
    event_id: `event_id`,
    transaction: `transaction`,
    children: [],
    ...partial,
  };
}

export function makeExampleTrace(metadata: TraceTree.Metadata): TraceTree {
  const trace: TraceTree.Trace = {
    transactions: [],
    orphan_errors: [],
  };

  function randomBetween(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  let start = new Date().getTime();

  const root = partialTransaction({
    ...metadata,
    generation: 0,
    start_timestamp: start,
    transaction: 'root transaction',
    timestamp: start + randomBetween(100, 200),
  });

  trace.transactions.push(root);

  for (let i = 0; i < 50; i++) {
    const end = start + randomBetween(100, 200);
    const nest = i > 0 && Math.random() > 0.33;

    if (nest) {
      const parent = root.children[root.children.length - 1];
      parent.children.push(
        partialTransaction({
          ...metadata,
          generation: 0,
          start_timestamp: start,
          transaction: `parent transaction ${i}`,
          timestamp: end,
        })
      );
      parent.timestamp = end;
    } else {
      root.children.push(
        partialTransaction({
          ...metadata,
          generation: 0,
          start_timestamp: start,
          transaction: 'loading...',
          ['transaction.op']: 'loading',
          timestamp: end,
        })
      );
    }

    start = end;
  }

  const tree = TraceTree.FromTrace(trace);

  return tree;
}

function nodeToId(n: TraceTreeNode<TraceTree.NodeValue>): TraceTree.NodePath {
  if (isTransactionNode(n)) {
    return `txn:${n.value.event_id}`;
  }
  if (isSpanNode(n)) {
    return `span:${n.value.span_id}`;
  }
  if (isAutogroupedNode(n)) {
    if (isParentAutogroupedNode(n)) {
      return `ag:${n.head.value.span_id}`;
    }
    if (isSiblingAutogroupedNode(n)) {
      const child = n.children[0];
      if (isSpanNode(child)) {
        return `ag:${child.value.span_id}`;
      }
    }
  }
  if (isTraceNode(n)) {
    return `trace:root`;
  }

  if (isTraceErrorNode(n)) {
    return `error:${n.value.event_id}`;
  }

  if (isRootNode(n)) {
    throw new Error('A path to root node does not exist as the node is virtual');
  }

  if (isMissingInstrumentationNode(n)) {
    if (n.previous) {
      return `ms:${n.previous.value.span_id}`;
    }
    if (n.next) {
      return `ms:${n.next.value.span_id}`;
    }

    throw new Error('Missing instrumentation node must have a previous or next node');
  }

  throw new Error('Not implemented');
}

export function computeAutogroupedBarSegments(
  nodes: TraceTreeNode<TraceTree.NodeValue>[]
): [number, number][] {
  if (nodes.length === 0) {
    return [];
  }

  if (nodes.length === 1) {
    const space = nodes[0].space;
    if (!space) {
      throw new Error(
        'Autogrouped node child has no defined space. This should not happen.'
      );
    }
    return [space];
  }

  const first = nodes[0];
  const multiplier = first.multiplier;

  if (!isSpanNode(first)) {
    throw new Error('Autogrouped node must have span children');
  }

  const segments: [number, number][] = [];

  let start = first.value.start_timestamp;
  let end = first.value.timestamp;
  let i = 1;

  while (i < nodes.length) {
    const next = nodes[i];

    if (!isSpanNode(next)) {
      throw new Error('Autogrouped node must have span children');
    }

    if (next.value.start_timestamp > end) {
      segments.push([start * multiplier, (end - start) * multiplier]);
      start = next.value.start_timestamp;
      end = next.value.timestamp;
      i++;
    } else {
      end = next.value.timestamp;
      i++;
    }
  }

  segments.push([start * multiplier, (end - start) * multiplier]);

  return segments;
}

// Returns a list of errors or performance issues related to the txn
// with ids matching the span id
function getSpanErrorsOrIssuesFromTransaction(
  span: RawSpanType,
  txn: TraceTree.Transaction
): TraceErrorOrIssue[] {
  if (!txn.performance_issues.length && !txn.errors.length) {
    return [];
  }

  const errorsOrIssues: TraceErrorOrIssue[] = [];

  for (const perfIssue of txn.performance_issues) {
    for (const s of perfIssue.span) {
      if (s === span.span_id) {
        errorsOrIssues.push(perfIssue);
      }
    }

    for (const suspect of perfIssue.suspect_spans) {
      if (suspect === span.span_id) {
        errorsOrIssues.push(perfIssue);
      }
    }
  }

  for (const error of txn.errors) {
    if (error.span === span.span_id) {
      errorsOrIssues.push(error);
    }
  }

  return errorsOrIssues;
}

function printNode(t: TraceTreeNode<TraceTree.NodeValue>, offset: number): string {
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
    return padding + t.value.event_id || 'unknown trace error';
  }

  return 'unknown node';
}
