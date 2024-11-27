import * as Sentry from '@sentry/react';
import type {Location} from 'history';
import * as qs from 'query-string';

import type {Client} from 'sentry/api';
import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import type {Event, EventTransaction, Measurement} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {
  TraceError as TraceErrorType,
  TraceFullDetailed,
  TracePerformanceIssue as TracePerformanceIssueType,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {collectTraceMeasurements} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree.measurements';
import type {TracePreferencesState} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import type {ReplayTrace} from 'sentry/views/replays/detail/trace/useReplayTraces';
import type {ReplayRecord} from 'sentry/views/replays/types';

import {isRootTransaction} from '../../traceDetails/utils';
import {getTraceQueryParams} from '../traceApi/useTrace';
import type {TraceMetaQueryResults} from '../traceApi/useTraceMeta';
import {
  getPageloadTransactionChildCount,
  isAutogroupedNode,
  isBrowserRequestSpan,
  isCollapsedNode,
  isJavascriptSDKTransaction,
  isMissingInstrumentationNode,
  isPageloadTransactionNode,
  isParentAutogroupedNode,
  isRootNode,
  isServerRequestHandlerTransactionNode,
  isSiblingAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTraceNode,
  isTransactionNode,
  shouldAddMissingInstrumentationSpan,
} from '../traceGuards';

import {makeExampleTrace} from './makeExampleTrace';
import {MissingInstrumentationNode} from './missingInstrumentationNode';
import {ParentAutogroupNode} from './parentAutogroupNode';
import {SiblingAutogroupNode} from './siblingAutogroupNode';
import {TraceTreeEventDispatcher} from './traceTreeEventDispatcher';
import {TraceTreeNode} from './traceTreeNode';

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
 * back to the tail, and have autogrouped node point to its head as the children.
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
 * - the notion of expanded and zoomed is confusing, they stand for the same idea from a UI pov
 * - ???
 */

export declare namespace TraceTree {
  interface TraceTreeEvents {
    ['trace timeline change']: (view: [number, number]) => void;
  }

  // Raw node values
  interface Span extends RawSpanType {
    measurements?: Record<string, Measurement>;
  }

  interface Transaction extends TraceFullDetailed {
    profiler_id: string;
    sdk_name: string;
  }

  type Trace = TraceSplitResults<Transaction>;
  type TraceError = TraceErrorType;
  type TracePerformanceIssue = TracePerformanceIssueType;
  type Profile = {profile_id: string} | {profiler_id: string};
  type Project = {
    id: number;
    slug: string;
  };
  type Root = null;

  // All possible node value types
  type NodeValue =
    | Trace
    | Transaction
    | TraceError
    | Span
    | MissingInstrumentationSpan
    | SiblingAutogroup
    | ChildrenAutogroup
    | CollapsedNode
    | Root;

  interface CollapsedNode {
    type: 'collapsed';
  }

  // Node types
  interface MissingInstrumentationSpan {
    start_timestamp: number;
    timestamp: number;
    type: 'missing_instrumentation';
  }
  interface SiblingAutogroup extends Span {
    autogrouped_by: {
      description: string;
      op: string;
    };
  }

  interface ChildrenAutogroup extends Span {
    autogrouped_by: {
      op: string;
    };
  }

  // All possible node types
  type Node =
    | TraceTreeNode<NodeValue>
    | ParentAutogroupNode
    | SiblingAutogroupNode
    | MissingInstrumentationNode;

  type NodePath =
    `${'txn' | 'span' | 'ag' | 'trace' | 'ms' | 'error' | 'empty'}-${string}`;

  type Metadata = {
    event_id: string | undefined;
    project_slug: string | undefined;
    spans?: number;
  };

  type Indicator = {
    duration: number;
    label: string;
    measurement: Measurement;
    poor: boolean;
    start: number;
    type: 'cls' | 'fcp' | 'fp' | 'lcp' | 'ttfb';
  };

  type CollectedVital = {key: string; measurement: Measurement};
}

export enum TraceShape {
  ONE_ROOT = 'one_root',
  NO_ROOT = 'no_root',
  BROWSER_MULTIPLE_ROOTS = 'browser_multiple_roots',
  MULTIPLE_ROOTS = 'multiple_roots',
  BROKEN_SUBTRACES = 'broken_subtraces',
  ONLY_ERRORS = 'only_errors',
  EMPTY_TRACE = 'empty_trace',
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

function fetchTrace(
  api: Client,
  params: {
    orgSlug: string;
    query: string;
    traceId: string;
  }
): Promise<TraceSplitResults<TraceTree.Transaction>> {
  return api.requestPromise(
    `/organizations/${params.orgSlug}/events-trace/${params.traceId}/?${params.query}`
  );
}

export class TraceTree extends TraceTreeEventDispatcher {
  eventsCount = 0;
  projects = new Set<TraceTree.Project>();

  type: 'loading' | 'empty' | 'error' | 'trace' = 'trace';
  root: TraceTreeNode<null> = TraceTreeNode.Root();

  vital_types: Set<'web' | 'mobile'> = new Set();
  vitals = new Map<TraceTreeNode<TraceTree.NodeValue>, TraceTree.CollectedVital[]>();

  profiled_events = new Set<TraceTreeNode<TraceTree.NodeValue>>();
  indicators: TraceTree.Indicator[] = [];

  list: TraceTreeNode<TraceTree.NodeValue>[] = [];
  events: Map<string, EventTransaction> = new Map();

  private _spanPromises: Map<string, Promise<EventTransaction>> = new Map();
  static MISSING_INSTRUMENTATION_THRESHOLD_MS = 100;

  static Empty() {
    const tree = new TraceTree().build();
    tree.type = 'empty';
    return tree;
  }

  static Loading(metadata: TraceTree.Metadata): TraceTree {
    const t = makeExampleTrace(metadata);
    t.type = 'loading';
    t.build();
    return t;
  }

  static Error(metadata: TraceTree.Metadata): TraceTree {
    const t = makeExampleTrace(metadata);
    t.type = 'error';
    t.build();
    return t;
  }

  static FromTrace(
    trace: TraceTree.Trace,
    options: {
      meta: TraceMetaQueryResults['data'] | null;
      replay: ReplayRecord | null;
    }
  ): TraceTree {
    const tree = new TraceTree();

    const traceNode = new TraceTreeNode<TraceTree.Trace>(tree.root, trace, {
      event_id: undefined,
      project_slug: undefined,
    });

    tree.root.children.push(traceNode);

    function visit(
      parent: TraceTreeNode<TraceTree.NodeValue | null>,
      value: TraceTree.Transaction | TraceTree.TraceError
    ) {
      tree.eventsCount++;
      tree.projects.add({
        id: value.project_id,
        slug: value.project_slug,
      });

      const node = new TraceTreeNode(parent, value, {
        spans: options.meta?.transactiontoSpanChildrenCount[value.event_id] ?? 0,
        project_slug: value && 'project_slug' in value ? value.project_slug : undefined,
        event_id: value && 'event_id' in value ? value.event_id : undefined,
      });

      if (isTransactionNode(node)) {
        const spanChildrenCount =
          options.meta?.transactiontoSpanChildrenCount[node.value.event_id];

        // We check for >1 events, as the first one is the transaction node itself
        node.canFetch = spanChildrenCount === undefined ? true : spanChildrenCount > 1;
      }

      if (!node.metadata.project_slug && !node.metadata.event_id) {
        const parentNodeMetadata = TraceTree.ParentTransaction(node)?.metadata;
        if (parentNodeMetadata) {
          node.metadata = {...parentNodeMetadata};
        }
      }

      parent.children.push(node);

      if (node.value && 'children' in node.value) {
        for (const child of node.value.children) {
          visit(node, child);
        }
      }
    }

    traceQueueIterator(trace, traceNode, visit);

    // At this point, the tree is built, we need  iterate over it again to collect all of the
    // measurements, web vitals, errors and perf issues as well as calculate the min and max space
    // the trace should take up.
    const traceSpaceBounds = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

    TraceTree.ForEachChild(traceNode, c => {
      traceSpaceBounds[0] = Math.min(traceSpaceBounds[0], c.space[0]);
      traceSpaceBounds[1] = Math.max(traceSpaceBounds[1], c.space[0] + c.space[1]);

      if (isTransactionNode(c)) {
        for (const error of c.value.errors) {
          traceNode.errors.add(error);
        }

        for (const performanceIssue of c.value.performance_issues) {
          traceNode.performance_issues.add(performanceIssue);
        }
      }

      if (isTraceErrorNode(c)) {
        traceNode.errors.add(c.value);
      }

      if (c.profiles.length > 0) {
        tree.profiled_events.add(c);
      }

      if (c.value && 'measurements' in c.value) {
        tree.indicators = tree.indicators.concat(
          collectTraceMeasurements(
            c,
            c.space[0],
            c.value.measurements,
            tree.vitals,
            tree.vital_types
          )
        );
      }

      if (
        c.parent &&
        isPageloadTransactionNode(c) &&
        isServerRequestHandlerTransactionNode(c.parent) &&
        getPageloadTransactionChildCount(c.parent) === 1
      ) {
        //   // The swap can occur at a later point when new transactions are fetched,
        //   // which means we need to invalidate the tree and re-render the UI.
        const parent = c.parent.parent;
        TraceTree.Swap({parent: c.parent, child: c, reason: 'pageload server handler'});
        TraceTree.invalidate(parent!, true);
      }
    });

    // The sum of all durations of traces that exist under a replay is not always
    // equal to the duration of the replay. We need to adjust the traceview bounds
    // to ensure that we can see the max of the replay duration and the sum(trace durations). This way, we
    // can ensure that the replay timestamp indicators are always visible in the traceview along with all spans from the traces.
    if (options.replay) {
      const replayStart = options.replay.started_at.getTime();
      const replayEnd = options.replay.finished_at.getTime();

      traceSpaceBounds[0] = Math.min(traceSpaceBounds[0], replayStart);
      traceSpaceBounds[1] = Math.max(traceSpaceBounds[1], replayEnd);
    }

    for (const indicator of tree.indicators) {
      // If any indicator starts after the trace ends, set end to the indicator start
      if (indicator.start > traceSpaceBounds[1]) {
        traceSpaceBounds[1] = indicator.start;
      }
      // If an indicator starts before the trace start, set start to the indicator start
      if (indicator.start < traceSpaceBounds[0]) {
        traceSpaceBounds[0] = indicator.start;
      }
    }

    // Space needs a start and end, if we don't have one we can't construct a timeline.
    if (!Number.isFinite(traceSpaceBounds[0])) {
      traceSpaceBounds[0] = 0;
    }
    if (!Number.isFinite(traceSpaceBounds[1])) {
      traceSpaceBounds[1] = 0;
    }

    const space = [traceSpaceBounds[0], traceSpaceBounds[1] - traceSpaceBounds[0]];

    tree.root.space = [space[0], space[1]];
    traceNode.space = [space[0], space[1]];

    tree.indicators.sort((a, b) => a.start - b.start);
    return tree;
  }

  static FromSpans(
    node: TraceTreeNode<TraceTree.NodeValue>,
    spans: TraceTree.Span[],
    event: EventTransaction | null
  ): [TraceTreeNode<TraceTree.NodeValue>, [number, number]] {
    // collect transactions
    const transactions = TraceTree.FindAll(node, n =>
      isTransactionNode(n)
    ) as TraceTreeNode<TraceTree.Transaction>[];

    // Create span nodes
    const spanNodes: TraceTreeNode<TraceTree.Span>[] = [];
    const spanIdToNode = new Map<string, TraceTreeNode<TraceTree.NodeValue>>();

    // Transactions have a span_id that needs to be used as the edge to child child span
    if (node.value && 'span_id' in node.value) {
      spanIdToNode.set(node.value.span_id, node);
    }

    for (const span of spans) {
      const spanNode: TraceTreeNode<TraceTree.Span> = new TraceTreeNode(null, span, {
        event_id: node.metadata.event_id,
        project_slug: node.metadata.project_slug,
      });
      spanNode.event = event;

      if (spanIdToNode.has(span.span_id)) {
        Sentry.withScope(scope => {
          scope.setFingerprint(['trace-span-id-hash-collision']);
          scope.captureMessage('Span ID hash collision detected');
        });
      }

      spanIdToNode.set(span.span_id, spanNode);
      spanNodes.push(spanNode);
    }

    // Clear children of root node as we are recreating the sub tree
    node.children = [];

    // Construct the span tree
    for (const span of spanNodes) {
      // If the span has no parent span id, nest it under the root
      const parent = span.value.parent_span_id
        ? spanIdToNode.get(span.value.parent_span_id) ?? node
        : node;

      span.parent = parent;
      parent.children.push(span);
    }

    // Reparent transactions under children spans
    for (const transaction of transactions) {
      const parent = spanIdToNode.get(transaction.value.parent_span_id!);
      // If the parent span does not exist in the span tree, the transaction will remain under the current node
      if (!parent) {
        if (transaction.parent?.children.indexOf(transaction) === -1) {
          transaction.parent.children.push(transaction);
        }
        continue;
      }

      if (transaction === node) {
        Sentry.withScope(scope => {
          scope.setFingerprint(['trace-tree-span-parent-cycle']);
          scope.captureMessage(
            'Span is a parent of its own transaction, this should not be possible'
          );
        });
        continue;
      }

      parent.children.push(transaction);
      transaction.parent = parent;
    }

    const subTreeSpaceBounds: [number, number] = [node.space[0], node.space[1]];

    TraceTree.ForEachChild(node, c => {
      c.invalidate();
      // When reparenting transactions under spans, the children are not guaranteed to be in order
      // so we need to sort them chronologically after the reparenting is complete
      // Track the min and max space of the sub tree as spans have ms precision
      subTreeSpaceBounds[0] = Math.min(subTreeSpaceBounds[0], c.space[0]);
      subTreeSpaceBounds[1] = Math.max(subTreeSpaceBounds[1], c.space[1]);

      if (isSpanNode(c)) {
        for (const performanceIssue of getRelatedPerformanceIssuesFromTransaction(
          c.value,
          node
        )) {
          c.performance_issues.add(performanceIssue);
        }
        for (const error of getRelatedSpanErrorsFromTransaction(c.value, node)) {
          c.errors.add(error);
        }
        if (isBrowserRequestSpan(c.value)) {
          const serverRequestHandler = c.parent?.children.find(n =>
            isServerRequestHandlerTransactionNode(n)
          );
          if (serverRequestHandler) {
            serverRequestHandler.parent!.children =
              serverRequestHandler.parent!.children.filter(
                n => n !== serverRequestHandler
              );
            c.children.push(serverRequestHandler);
            serverRequestHandler.parent = c;
          }
        }
      }
      c.children.sort(traceChronologicalSort);
    });

    if (!Number.isFinite(subTreeSpaceBounds[0])) {
      subTreeSpaceBounds[0] = 0;
    }
    if (!Number.isFinite(subTreeSpaceBounds[1])) {
      subTreeSpaceBounds[1] = 0;
    }

    return [node, subTreeSpaceBounds];
  }

  appendTree(tree: TraceTree) {
    const baseTraceNode = this.root.children[0];
    const additionalTraceNode = tree.root.children[0];

    if (!baseTraceNode || !additionalTraceNode) {
      throw new Error('No trace node found in tree');
    }

    for (const child of additionalTraceNode.children) {
      child.parent = baseTraceNode;
      baseTraceNode.children.push(child);
    }

    for (const error of additionalTraceNode.errors) {
      baseTraceNode.errors.add(error);
    }

    for (const performanceIssue of additionalTraceNode.performance_issues) {
      baseTraceNode.performance_issues.add(performanceIssue);
    }

    for (const profile of additionalTraceNode.profiles) {
      baseTraceNode.profiles.push(profile);
    }

    for (const [node, vitals] of tree.vitals) {
      this.vitals.set(node, vitals);
    }

    for (const [node, _] of tree.vitals) {
      if (
        baseTraceNode.space?.[0] &&
        node.value &&
        'start_timestamp' in node.value &&
        'measurements' in node.value
      ) {
        tree.indicators = tree.indicators.concat(
          collectTraceMeasurements(
            node,
            baseTraceNode.space[0],
            node.value.measurements,
            this.vitals,
            this.vital_types
          )
        );
      }
    }

    // We need to invalidate the data in the last node of the tree
    // so that the connectors are updated and pointing to the sibling nodes
    const last = this.root.children[this.root.children.length - 1];
    TraceTree.invalidate(last, true);

    const previousEnd = this.root.space[0] + this.root.space[1];
    const newEnd = tree.root.space[0] + tree.root.space[1];

    this.root.space[0] = Math.min(tree.root.space[0], this.root.space[0]);
    this.root.space[1] = Math.max(
      previousEnd - this.root.space[0],
      newEnd - this.root.space[0]
    );

    for (const child of tree.root.children) {
      this.list = this.list.concat(TraceTree.VisibleChildren(child));
    }
  }

  /**
   * Invalidate the visual data used to render the tree, forcing it
   * to be recalculated on the next render. This is useful when for example
   * the tree is expanded or collapsed, or when the tree is mutated and
   * the visual data is no longer valid as the indentation changes
   */
  static invalidate(node: TraceTreeNode<TraceTree.NodeValue>, recurse: boolean) {
    node.invalidate();

    if (recurse) {
      const queue = [...node.children];

      if (isParentAutogroupedNode(node)) {
        queue.push(node.head);
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

  static DetectMissingInstrumentation(root: TraceTreeNode<TraceTree.NodeValue>): number {
    let previous: TraceTreeNode<TraceTree.NodeValue> | null = null;
    let missingInstrumentationCount = 0;

    TraceTree.ForEachChild(root, child => {
      if (
        previous &&
        child &&
        isSpanNode(previous) &&
        isSpanNode(child) &&
        shouldAddMissingInstrumentationSpan(child.event?.sdk?.name ?? '') &&
        shouldAddMissingInstrumentationSpan(previous.event?.sdk?.name ?? '') &&
        child.space[0] - previous.space[0] - previous.space[1] >=
          TraceTree.MISSING_INSTRUMENTATION_THRESHOLD_MS
      ) {
        const node = new MissingInstrumentationNode(
          child.parent!,
          {
            type: 'missing_instrumentation',
            start_timestamp: previous.value.timestamp,
            timestamp: child.value.start_timestamp,
          },
          {
            event_id: undefined,
            project_slug: undefined,
          },
          previous,
          child
        );
        missingInstrumentationCount++;

        if (child.parent === previous) {
          // The tree is dfs iterated, so it can only ever be the first child
          previous.children.splice(0, 0, node);
          node.parent = previous;
        } else {
          const childIndex = child.parent?.children.indexOf(child) ?? -1;
          if (childIndex === -1) {
            Sentry.captureException('Detecting missing instrumentation failed');
            return;
          }

          child.parent?.children.splice(childIndex, 0, node);
        }

        previous = node;
        return;
      }

      previous = child;
    });

    return missingInstrumentationCount;
  }

  // We can just filter out the missing instrumentation
  // nodes as they never have any children that require remapping
  static RemoveMissingInstrumentationNodes(
    root: TraceTreeNode<TraceTree.NodeValue>
  ): number {
    let removeCount = 0;

    TraceTree.Filter(root, node => {
      if (isMissingInstrumentationNode(node)) {
        removeCount++;
        return false;
      }
      return true;
    });

    return removeCount;
  }

  static AutogroupDirectChildrenSpanNodes(
    root: TraceTreeNode<TraceTree.NodeValue>
  ): number {
    const queue = [root];
    let autogroupCount = 0;

    while (queue.length > 0) {
      const node = queue.pop()!;

      if (!isSpanNode(node) || node.children.length > 1) {
        for (const child of node.children) {
          queue.push(child);
        }
        continue;
      }

      const head = node;
      let tail = node;
      let groupMatchCount = 0;

      let errors: TraceErrorType[] = [];
      let performance_issues: TraceTree.TracePerformanceIssue[] = [];

      let start = head.space[0];
      let end = head.space[0] + head.space[1];

      while (
        tail &&
        tail.children.length === 1 &&
        isSpanNode(tail.children[0]) &&
        tail.children[0].value.op === head.value.op
      ) {
        start = Math.min(start, tail.space[0]);
        end = Math.max(end, tail.space[0] + tail.space[1]);

        errors = errors.concat(Array.from(tail.errors));
        performance_issues = performance_issues.concat(
          Array.from(tail.performance_issues)
        );

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
        head,
        tail
      );
      autogroupCount++;

      if (!node.parent) {
        throw new Error('Parent node is missing, this should be unreachable code');
      }

      const children = isParentAutogroupedNode(node.parent)
        ? node.parent.tail.children
        : node.parent.children;

      const index = children.indexOf(node);
      if (index === -1) {
        throw new Error('Node is not a child of its parent');
      }
      children[index] = autoGroupedNode;

      autoGroupedNode.head.parent = autoGroupedNode;
      autoGroupedNode.groupCount = groupMatchCount + 1;

      // Checking the tail node for errors as it is not included in the grouping
      // while loop, but is hidden when the autogrouped node is collapsed
      errors = errors.concat(Array.from(tail.errors));
      performance_issues = performance_issues.concat(Array.from(tail.performance_issues));

      start = Math.min(start, tail.space[0]);
      end = Math.max(end, tail.space[0] + tail.space[1]);

      autoGroupedNode.space = [start, end - start];
      autoGroupedNode.errors = new Set(errors);
      autoGroupedNode.performance_issues = new Set(performance_issues);

      for (const c of tail.children) {
        c.parent = autoGroupedNode;
        queue.push(c);
      }
    }

    return autogroupCount;
  }

  static RemoveDirectChildrenAutogroupNodes(
    root: TraceTreeNode<TraceTree.NodeValue>
  ): number {
    let removeCount = 0;

    TraceTree.ForEachChild(root, node => {
      if (isParentAutogroupedNode(node)) {
        const index = node.parent?.children.indexOf(node) ?? -1;
        if (!node.parent || index === -1) {
          Sentry.captureException('Removing direct children autogroup nodes failed');
          return;
        }

        removeCount++;
        node.parent.children[index] = node.head;
        // Head of parent now points to the parent of autogrouped node
        node.head.parent = node.parent;
        // All children now point to the tail of the autogrouped node
        for (const child of node.tail.children) {
          child.parent = node.tail;
        }
      }
    });

    return removeCount;
  }

  static AutogroupSiblingSpanNodes(root: TraceTreeNode<TraceTree.NodeValue>): number {
    const queue = [root];
    let autogroupCount = 0;

    while (queue.length > 0) {
      const node = queue.pop()!;

      if (isParentAutogroupedNode(node)) {
        queue.push(node.head);
      } else {
        for (const child of node.children) {
          queue.push(child);
        }
      }

      if (isAutogroupedNode(node) || isMissingInstrumentationNode(node)) {
        continue;
      }

      if (node.children.length < 5) {
        continue;
      }

      let index = 0;
      let matchCount = 0;

      while (index < node.children.length) {
        // Skip until we find a span candidate
        if (!isSpanNode(node.children[index])) {
          index++;
          matchCount = 0;
          continue;
        }

        const current = node.children[index] as TraceTreeNode<TraceTree.Span>;
        const next = node.children[index + 1] as TraceTreeNode<TraceTree.Span>;

        if (
          next &&
          isSpanNode(next) &&
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

          autogroupCount++;
          autoGroupedNode.groupCount = matchCount + 1;

          const start = index - matchCount;

          let start_timestamp = Number.POSITIVE_INFINITY;
          let timestamp = Number.NEGATIVE_INFINITY;

          for (let j = start; j < start + matchCount + 1; j++) {
            const child = node.children[j];

            start_timestamp = Math.min(start_timestamp, node.children[j].space[0]);
            timestamp = Math.max(
              timestamp,
              node.children[j].space[0] + node.children[j].space[1]
            );

            if (node.children[j].hasErrors) {
              for (const error of child.errors) {
                autoGroupedNode.errors.add(error);
              }

              for (const performanceIssue of child.performance_issues) {
                autoGroupedNode.performance_issues.add(performanceIssue);
              }
            }

            autoGroupedNode.children.push(node.children[j]);
            node.children[j].parent = autoGroupedNode;
          }

          autoGroupedNode.space = [start_timestamp, timestamp - start_timestamp];

          node.children.splice(start, matchCount + 1, autoGroupedNode);
          index = start + 1;
          matchCount = 0;
        } else {
          index++;
          matchCount = 0;
        }
      }
    }

    return autogroupCount;
  }

  static RemoveSiblingAutogroupNodes(root: TraceTreeNode<TraceTree.NodeValue>): number {
    let removeCount = 0;
    TraceTree.ForEachChild(root, node => {
      if (isSiblingAutogroupedNode(node)) {
        removeCount++;
        const index = node.parent?.children.indexOf(node) ?? -1;
        if (!node.parent || index === -1) {
          Sentry.captureException('Removing sibling autogroup nodes failed');
          return;
        }

        node.parent.children.splice(index, 1, ...node.children);

        for (const child of node.children) {
          child.parent = node.parent;
        }
      }
    });

    return removeCount;
  }

  static DirectVisibleChildren(
    node: TraceTreeNode<TraceTree.NodeValue>
  ): TraceTreeNode<TraceTree.NodeValue>[] {
    if (isParentAutogroupedNode(node)) {
      if (node.expanded) {
        return [node.head];
      }
      return node.tail.children;
    }

    return node.children;
  }

  static VisibleChildren(
    root: TraceTreeNode<TraceTree.NodeValue>
  ): TraceTreeNode<TraceTree.NodeValue>[] {
    const queue: TraceTreeNode<TraceTree.NodeValue>[] = [];
    const visibleChildren: TraceTreeNode<TraceTree.NodeValue>[] = [];

    if (root.expanded || isParentAutogroupedNode(root)) {
      const children = TraceTree.DirectVisibleChildren(root);

      for (let i = children.length - 1; i >= 0; i--) {
        queue.push(children[i]);
      }
    }

    while (queue.length > 0) {
      const node = queue.pop()!;

      visibleChildren.push(node);

      // iterate in reverse to ensure nodes are processed in order
      if (node.expanded || isParentAutogroupedNode(node)) {
        const children = TraceTree.DirectVisibleChildren(node);

        for (let i = children.length - 1; i >= 0; i--) {
          queue.push(children[i]);
        }
      }
    }

    return visibleChildren;
  }

  static PathToNode(node: TraceTreeNode<TraceTree.NodeValue>): TraceTree.NodePath[] {
    // If the node is a transaction node, then it will not require any
    // fetching and we can link to it directly
    if (isTransactionNode(node)) {
      return [nodeToId(node)];
    }

    // Otherwise, we need to traverse up the tree until we find a transaction node.
    const nodes: TraceTreeNode<TraceTree.NodeValue>[] = [node];
    let current: TraceTreeNode<TraceTree.NodeValue> | null = node.parent;

    while (current && !isTransactionNode(current)) {
      current = current.parent;
    }

    if (current && isTransactionNode(current)) {
      nodes.push(current);
    }

    return nodes.map(nodeToId);
  }

  static ForEachChild(
    root: TraceTreeNode<TraceTree.NodeValue>,
    cb: (node: TraceTreeNode<TraceTree.NodeValue>) => void
  ): void {
    const queue: TraceTreeNode<TraceTree.NodeValue>[] = [];

    if (isParentAutogroupedNode(root)) {
      queue.push(root.head);
    } else {
      for (let i = root.children.length - 1; i >= 0; i--) {
        queue.push(root.children[i]);
      }
    }

    while (queue.length > 0) {
      const next = queue.pop()!;
      cb(next);

      // Parent autogroup nodes have a head and tail pointer instead of children
      if (isParentAutogroupedNode(next)) {
        queue.push(next.head);
      } else {
        for (let i = next.children.length - 1; i >= 0; i--) {
          queue.push(next.children[i]);
        }
      }
    }
  }

  // Removes node and all its children from the tree
  static Filter(
    node: TraceTreeNode<TraceTree.NodeValue>,
    predicate: (node: TraceTreeNode) => boolean
  ): TraceTreeNode<TraceTree.NodeValue> {
    const queue = [node];

    while (queue.length) {
      const next = queue.pop()!;

      next.children = next.children.filter(c => {
        if (predicate(c)) {
          queue.push(c);
          return true;
        }
        return false;
      });
    }

    return node;
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

  static FindAll(
    root: TraceTreeNode<TraceTree.NodeValue>,
    predicate: (node: TraceTreeNode<TraceTree.NodeValue>) => boolean
  ): TraceTreeNode<TraceTree.NodeValue>[] {
    const queue = [root];
    const results: TraceTreeNode<TraceTree.NodeValue>[] = [];

    while (queue.length > 0) {
      const next = queue.pop()!;

      if (predicate(next)) {
        results.push(next);
      }

      if (isParentAutogroupedNode(next)) {
        queue.push(next.head);
      } else {
        for (let i = next.children.length - 1; i >= 0; i--) {
          queue.push(next.children[i]);
        }
      }
    }

    return results;
  }

  static FindByPath(
    tree: TraceTree,
    path: TraceTree.NodePath
  ): TraceTreeNode<TraceTree.NodeValue> | null {
    const [type, id, rest] = path.split('-');

    if (!type || !id || rest) {
      Sentry.withScope(scope => {
        scope.setFingerprint(['trace-view-path-error']);
        scope.captureMessage('Invalid path to trace tree node ');
      });
      return null;
    }

    if (type === 'trace' && id === 'root') {
      return tree.root.children[0];
    }

    return TraceTree.Find(tree.root, node => {
      if (type === 'txn' && isTransactionNode(node)) {
        // A transaction itself is a span and we are starting to treat it as such.
        // Hence we check for both event_id and span_id.
        return node.value.event_id === id || node.value.span_id === id;
      }
      if (type === 'span' && isSpanNode(node)) {
        return node.value.span_id === id;
      }

      if (type === 'ag' && isAutogroupedNode(node)) {
        if (isParentAutogroupedNode(node)) {
          return (
            node.value.span_id === id ||
            node.head.value.span_id === id ||
            node.tail.value.span_id === id
          );
        }
        if (isSiblingAutogroupedNode(node)) {
          const child = node.children[0];
          if (isSpanNode(child)) {
            return child.value.span_id === id;
          }
        }
      }

      if (type === 'ms' && isMissingInstrumentationNode(node)) {
        return node.previous.value.span_id === id || node.next.value.span_id === id;
      }

      if (type === 'error' && isTraceErrorNode(node)) {
        return node.value.event_id === id;
      }

      return false;
    });
  }

  static FindByID(
    root: TraceTreeNode<TraceTree.NodeValue>,
    eventId: string
  ): TraceTreeNode<TraceTree.NodeValue> | null {
    return TraceTree.Find(root, n => {
      if (isTransactionNode(n)) {
        // A transaction itself is a span and we are starting to treat it as such.
        // Hence we check for both event_id and span_id.
        return n.value.event_id === eventId || n.value.span_id === eventId;
      }
      if (isSpanNode(n)) {
        return n.value.span_id === eventId;
      }
      if (isTraceErrorNode(n)) {
        return n.value.event_id === eventId;
      }
      if (isTraceNode(n)) {
        return false;
      }
      if (isMissingInstrumentationNode(n)) {
        return n.previous.value.span_id === eventId || n.next.value.span_id === eventId;
      }
      if (isParentAutogroupedNode(n)) {
        return (
          n.value.span_id === eventId ||
          n.head.value.span_id === eventId ||
          n.tail.value.span_id === eventId
        );
      }

      if (isSiblingAutogroupedNode(n)) {
        const child = n.children[0];
        if (isSpanNode(child)) {
          return child.value.span_id === eventId;
        }
      }

      if (eventId === 'root' && isTraceNode(n)) {
        return true;
      }

      // If we dont have an exact match, then look for an event_id in the errors or performance issues
      for (const e of n.errors) {
        if (e.event_id === eventId) {
          return true;
        }
      }
      for (const p of n.performance_issues) {
        if (p.event_id === eventId) {
          return true;
        }
      }

      return false;
    });
  }

  static ParentTransaction(
    node: TraceTreeNode<TraceTree.NodeValue>
  ): TraceTreeNode<TraceTree.Transaction> | null {
    let next: TraceTreeNode<TraceTree.NodeValue> | null = node.parent;

    while (next) {
      if (isTransactionNode(next)) {
        return next;
      }
      next = next.parent;
    }

    return null;
  }

  expand(node: TraceTreeNode<TraceTree.NodeValue>, expanded: boolean): boolean {
    // Trace root nodes are not expandable or collapsable
    if (isTraceNode(node)) {
      return false;
    }

    // Expanding is not allowed for zoomed in nodes
    if (expanded === node.expanded || node.zoomedIn) {
      return false;
    }

    if (isParentAutogroupedNode(node)) {
      if (!expanded) {
        const index = this.list.indexOf(node);
        this.list.splice(index + 1, TraceTree.VisibleChildren(node).length);

        // When we collapse the autogroup, we need to point the tail children
        // back to the tail autogroup node.
        for (const c of node.tail.children) {
          c.parent = node;
        }

        this.list.splice(index + 1, 0, ...TraceTree.VisibleChildren(node.tail));
      } else {
        const index = this.list.indexOf(node);
        this.list.splice(index + 1, TraceTree.VisibleChildren(node).length);

        // When the node is collapsed, children point to the autogrouped node.
        // We need to point them back to the tail node which is now visible
        for (const c of node.tail.children) {
          c.parent = node.tail;
        }

        this.list.splice(
          index + 1,
          0,
          node.head,
          ...TraceTree.VisibleChildren(node.head)
        );
      }

      TraceTree.invalidate(node, true);
      node.expanded = expanded;
      return true;
    }

    if (!expanded) {
      const index = this.list.indexOf(node);
      this.list.splice(index + 1, TraceTree.VisibleChildren(node).length);

      node.expanded = expanded;
      // When transaction nodes are collapsed, they still render child transactions
      if (isTransactionNode(node)) {
        this.list.splice(index + 1, 0, ...TraceTree.VisibleChildren(node));
      }
    } else {
      node.expanded = expanded;
      // Flip expanded so that we can collect visible children
      const index = this.list.indexOf(node);
      this.list.splice(index + 1, 0, ...TraceTree.VisibleChildren(node));
    }

    TraceTree.invalidate(node, true);
    return true;
  }

  zoom(
    node: TraceTreeNode<TraceTree.NodeValue>,
    zoomedIn: boolean,
    options: {
      api: Client;
      organization: Organization;
      preferences: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
    }
  ): Promise<Event | null> {
    if (isTraceNode(node)) {
      return Promise.resolve(null);
    }

    if (zoomedIn === node.zoomedIn || !node.canFetch) {
      return Promise.resolve(null);
    }

    if (!zoomedIn) {
      const index = this.list.indexOf(node);

      // Remove currently visible children
      this.list.splice(index + 1, TraceTree.VisibleChildren(node).length);
      // Flip visibility
      node.zoomedIn = zoomedIn;
      // When transactions are zoomed out, they still render child transactions
      if (isTransactionNode(node)) {
        // Find all transactions that are children of the current transaction
        // remove all non transaction events from current node and its children
        // point transactions back to their parents
        const transactions = TraceTree.FindAll(
          node,
          c => isTransactionNode(c) && c !== node
        );

        for (const t of transactions) {
          // point transactions back to their parents
          const parent = TraceTree.ParentTransaction(t);
          // If they already have the correct parent, then we can skip this
          if (t.parent === parent) {
            continue;
          }
          if (!parent) {
            Sentry.withScope(scope => {
              scope.setFingerprint(['trace-view-transaction-parent']);
              scope.captureMessage('Failed to find parent transaction when zooming out');
            });
            continue;
          }
          t.parent = parent;
          parent.children.push(t);
        }

        node.children = node.children.filter(c => isTransactionNode(c));
        node.children.sort(traceChronologicalSort);

        this.list.splice(index + 1, 0, ...TraceTree.VisibleChildren(node));
      }

      TraceTree.invalidate(node, true);
      return Promise.resolve(null);
    }

    const key =
      options.organization.slug +
      ':' +
      node.metadata.project_slug! +
      ':' +
      node.metadata.event_id!;

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
      .then((data: EventTransaction) => {
        // The user may have collapsed the node before the promise resolved. When that
        // happens, dont update the tree with the resolved data. Alternatively, we could implement
        // a cancellable promise and avoid this cumbersome heuristic.
        // Remove existing entries from the list
        const index = this.list.indexOf(node);
        node.fetchStatus = 'resolved';

        if (node.expanded && index !== -1) {
          const childrenCount = TraceTree.VisibleChildren(node).length;
          if (childrenCount > 0) {
            this.list.splice(index + 1, childrenCount);
          }
        }

        // API response is not sorted
        const spans = data.entries.find(s => s.type === 'spans') ?? {data: []};
        spans.data.sort((a, b) => a.start_timestamp - b.start_timestamp);

        const [root, spanTreeSpaceBounds] = TraceTree.FromSpans(node, spans.data, data);

        root.zoomedIn = true;
        // Spans contain millisecond precision, which means that it is possible for the
        // children spans of a transaction to extend beyond the start and end of the transaction
        // through ns precision. To account for this, we need to adjust the space of the transaction node and the space
        // of our trace so that all of the span children are visible and can be rendered inside the view
        const previousStart = this.root.space[0];
        const previousDuration = this.root.space[1];

        const newStart = spanTreeSpaceBounds[0];
        const newEnd = spanTreeSpaceBounds[0] + spanTreeSpaceBounds[1];

        // Extend the start of the trace to include the new min start
        if (newStart <= this.root.space[0]) {
          this.root.space[0] = newStart;
        }
        // Extend the end of the trace to include the new max end
        if (newEnd > this.root.space[0] + this.root.space[1]) {
          this.root.space[1] = newEnd - this.root.space[0];
        }

        if (
          previousStart !== this.root.space[0] ||
          previousDuration !== this.root.space[1]
        ) {
          this.dispatch('trace timeline change', this.root.space);
        }

        if (options.preferences.missing_instrumentation) {
          TraceTree.DetectMissingInstrumentation(root);
        }
        if (options.preferences.autogroup.sibling) {
          TraceTree.AutogroupSiblingSpanNodes(root);
        }
        if (options.preferences.autogroup.parent) {
          TraceTree.AutogroupDirectChildrenSpanNodes(root);
        }

        if (index !== -1) {
          this.list.splice(index + 1, 0, ...TraceTree.VisibleChildren(node));
        }
        return data;
      })
      .catch(_e => {
        node.fetchStatus = 'error';
      });

    this._spanPromises.set(key, promise);
    return promise;
  }

  static EnforceVisibility(
    tree: TraceTree,
    node: TraceTreeNode<TraceTree.NodeValue>
  ): number {
    let index = tree.list.indexOf(node);

    if (node && index === -1) {
      let parent_node = node.parent;
      while (parent_node) {
        // Transactions break autogrouping chains, so we can stop here
        tree.expand(parent_node, true);
        // This is very wasteful as it performs O(n^2) search each time we expand a node...
        // In most cases though, we should be operating on a tree with sub 10k elements and hopefully
        // a low autogrouped node count.
        index = node ? tree.list.indexOf(node) : -1;
        if (index !== -1) {
          break;
        }
        parent_node = parent_node.parent;
      }
    }

    return index;
  }

  static ExpandToEventID(
    tree: TraceTree,
    eventId: string,
    options: {
      api: Client;
      organization: Organization;
      preferences: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
    }
  ): Promise<void> {
    const node = TraceTree.FindByID(tree.root, eventId);

    if (!node) {
      return Promise.resolve();
    }

    return TraceTree.ExpandToPath(tree, TraceTree.PathToNode(node), options);
  }

  static ExpandToPath(
    tree: TraceTree,
    scrollQueue: TraceTree.NodePath[],
    options: {
      api: Client;
      organization: Organization;
      preferences: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
    }
  ): Promise<void> {
    const transactionIds = new Set(
      scrollQueue.filter(s => s.startsWith('txn-')).map(s => s.replace('txn-', ''))
    );

    // If we are just linking to a transaction, then we dont need to fetch its spans
    if (transactionIds.size === 1 && scrollQueue.length === 1) {
      return Promise.resolve();
    }

    const transactionNodes = TraceTree.FindAll(
      tree.root,
      node =>
        isTransactionNode(node) &&
        (transactionIds.has(node.value.span_id) ||
          transactionIds.has(node.value.event_id))
    );

    const promises = transactionNodes.map(node => tree.zoom(node, true, options));

    return Promise.all(promises)
      .then(_resp => {
        // Ignore response
      })
      .catch(e => {
        Sentry.withScope(scope => {
          scope.setFingerprint(['trace-view-expand-to-path-error']);
          scope.captureMessage('Failed to expand to path');
          scope.captureException(e);
        });
      });
  }

  // Only supports parent/child swaps (the only ones we need)
  static Swap({
    parent,
    child,
    reason,
  }: {
    child: TraceTreeNode<TraceTree.NodeValue>;
    parent: TraceTreeNode<TraceTree.NodeValue>;
    reason: TraceTreeNode['reparent_reason'];
  }) {
    const commonRoot = parent.parent!;
    const parentIndex = commonRoot.children.indexOf(parent);

    if (!commonRoot || parentIndex === -1) {
      throw new Error('Cannot find common parent');
    }

    TraceTree.Filter(commonRoot, c => c !== child);
    parent.parent = null;
    child.parent = null;

    // Insert child into parent
    commonRoot.children[parentIndex] = child;
    child.children.push(parent);

    child.parent = commonRoot;
    parent.parent = child;

    child.reparent_reason = reason;
    parent.reparent_reason = reason;
  }

  static IsLastChild(n: TraceTreeNode<TraceTree.NodeValue>): boolean {
    if (!n.parent) {
      return false;
    }

    if (isParentAutogroupedNode(n.parent)) {
      if (n.parent.expanded) {
        // The autogrouped
        return true;
      }
      return n.parent.tail.children[n.parent.tail.children.length - 1] === n;
    }

    return n.parent.children[n.parent.children.length - 1] === n;
  }

  static HasVisibleChildren(node: TraceTreeNode<TraceTree.NodeValue>): boolean {
    if (isParentAutogroupedNode(node)) {
      if (node.expanded) {
        return node.head.children.length > 0;
      }
      return node.tail.children.length > 0;
    }

    if (node.expanded) {
      return node.children.length > 0;
    }

    return false;
  }

  /**
   * Return a lazily calculated depth of the node in the tree.
   * Root node has a value of -1 as it is abstract.
   */
  static Depth(node: TraceTreeNode<any>): number {
    if (node.depth !== undefined) {
      return node.depth;
    }

    let depth = -2;
    let start: TraceTreeNode<any> | null = node;

    while (start) {
      depth++;
      start = start.parent;
    }

    node.depth = depth;
    return depth;
  }

  static ConnectorsTo(node: TraceTreeNode<TraceTree.NodeValue>): number[] {
    if (node.connectors !== undefined) {
      return node.connectors;
    }

    const connectors: number[] = [];
    let start: TraceTreeNode<TraceTree.NodeValue> | null = node.parent;

    if (start && isTraceNode(start) && !TraceTree.IsLastChild(node)) {
      node.connectors = [-TraceTree.Depth(node)];
      return node.connectors;
    }

    if (!TraceTree.IsLastChild(node)) {
      connectors.push(TraceTree.Depth(node));
    }

    while (start) {
      if (!start.value || !start.parent) {
        break;
      }

      if (TraceTree.IsLastChild(start)) {
        start = start.parent;
        continue;
      }

      connectors.push(
        isTraceNode(start.parent) ? -TraceTree.Depth(start) : TraceTree.Depth(start)
      );
      start = start.parent;
    }

    node.connectors = connectors;
    return connectors;
  }

  toList(): TraceTreeNode<TraceTree.NodeValue>[] {
    this.list = TraceTree.VisibleChildren(this.root);
    return this.list;
  }

  rebuild() {
    TraceTree.invalidate(this.root, true);
    this.list = this.toList();
    return this;
  }

  build() {
    this.list = this.toList();
    return this;
  }

  get shape(): TraceShape {
    const trace = this.root.children[0];
    if (!trace) {
      return TraceShape.EMPTY_TRACE;
    }

    if (!isTraceNode(trace)) {
      throw new TypeError('Not trace node');
    }

    const traceStats = trace.value.transactions?.reduce<{
      javascriptRootTransactions: TraceTree.Transaction[];
      orphans: number;
      roots: number;
    }>(
      (stats, transaction) => {
        if (isRootTransaction(transaction)) {
          stats.roots++;

          if (isJavascriptSDKTransaction(transaction)) {
            stats.javascriptRootTransactions.push(transaction);
          }
        } else {
          stats.orphans++;
        }
        return stats;
      },
      {roots: 0, orphans: 0, javascriptRootTransactions: []}
    ) ?? {roots: 0, orphans: 0, javascriptRootTransactions: []};

    if (traceStats.roots === 0) {
      if (traceStats.orphans > 0) {
        return TraceShape.NO_ROOT;
      }

      if ((trace.value.orphan_errors?.length ?? 0) > 0) {
        return TraceShape.ONLY_ERRORS;
      }

      return TraceShape.EMPTY_TRACE;
    }

    if (traceStats.roots === 1) {
      if (traceStats.orphans > 0) {
        return TraceShape.BROKEN_SUBTRACES;
      }

      return TraceShape.ONE_ROOT;
    }

    if (traceStats.roots > 1) {
      if (traceStats.javascriptRootTransactions.length > 0) {
        return TraceShape.BROWSER_MULTIPLE_ROOTS;
      }

      return TraceShape.MULTIPLE_ROOTS;
    }

    throw new Error('Unknown trace type');
  }

  fetchAdditionalTraces(options: {
    api: Client;
    filters: any;
    meta: TraceMetaQueryResults | null;
    organization: Organization;
    replayTraces: ReplayTrace[];
    rerender: () => void;
    urlParams: Location['query'];
  }): () => void {
    let cancelled = false;
    const {organization, api, urlParams, filters, rerender, replayTraces} = options;
    const clonedTraceIds = [...replayTraces];

    const root = this.root.children[0];
    root.fetchStatus = 'loading';
    rerender();

    (async () => {
      while (clonedTraceIds.length > 0) {
        const batch = clonedTraceIds.splice(0, 3);
        const results = await Promise.allSettled(
          batch.map(batchTraceData => {
            return fetchTrace(api, {
              orgSlug: organization.slug,
              query: qs.stringify(
                getTraceQueryParams(urlParams, filters.selection, {
                  timestamp: batchTraceData.timestamp,
                })
              ),
              traceId: batchTraceData.traceSlug,
            });
          })
        );

        if (cancelled) {
          return;
        }

        const updatedData = results.reduce(
          (acc, result) => {
            // Ignoring the error case for now
            if (result.status === 'fulfilled') {
              const {transactions, orphan_errors} = result.value;
              acc.transactions.push(...transactions);
              acc.orphan_errors.push(...orphan_errors);
            }

            return acc;
          },
          {
            transactions: [],
            orphan_errors: [],
          } as TraceSplitResults<TraceTree.Transaction>
        );

        this.appendTree(
          TraceTree.FromTrace(updatedData, {
            meta: options.meta?.data,
            replay: null,
          })
        );
        rerender();
      }

      root.fetchStatus = 'idle';
      rerender();
    })();

    return () => {
      root.fetchStatus = 'idle';
      cancelled = true;
    };
  }

  /**
   * Prints the tree in a human readable format, useful for debugging and testing
   */
  print() {
    // eslint-disable-next-line no-console
    console.log(this.serialize());
  }

  serialize() {
    return (
      '\n' +
      this.list
        .map(t => printTraceTreeNode(t, 0))
        .filter(Boolean)
        .join('\n') +
      '\n'
    );
  }
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
    return `ms-${n.previous.value.span_id}`;
  }

  throw new Error('Not implemented');
}

function printTraceTreeNode(
  t: TraceTreeNode<TraceTree.NodeValue>,
  offset: number
): string {
  // +1 because we may be printing from the root which is -1 indexed
  const padding = '  '.repeat(TraceTree.Depth(t) + offset);

  if (isAutogroupedNode(t)) {
    if (isParentAutogroupedNode(t)) {
      return padding + `parent autogroup (${t.head.value.op}: ${t.groupCount})`;
    }
    if (isSiblingAutogroupedNode(t)) {
      return (
        padding +
        `sibling autogroup (${(t.children[0] as TraceTreeNode<TraceTree.Span>)?.value?.op}: ${t.groupCount})`
      );
    }

    return padding + 'autogroup';
  }
  if (isSpanNode(t)) {
    return (
      padding +
      (t.value.op || 'unknown span') +
      ' - ' +
      (t.value.description || 'unknown description')
    );
  }
  if (isTransactionNode(t)) {
    return (
      padding +
      (t.value.transaction || 'unknown transaction') +
      ' - ' +
      (t.value['transaction.op'] ?? 'unknown op')
    );
  }
  if (isMissingInstrumentationNode(t)) {
    return padding + 'missing_instrumentation';
  }
  if (isRootNode(t)) {
    return padding + 'virtual root';
  }
  if (isTraceNode(t)) {
    return padding + 'trace root';
  }

  if (isTraceErrorNode(t)) {
    return padding + (t.value.event_id || t.value.level) || 'unknown trace error';
  }

  if (isCollapsedNode(t)) {
    return padding + 'collapsed';
  }

  return 'unknown node';
}

// Double queue iterator to merge transactions and errors into a single list ordered by timestamp
// without having to reallocate the potentially large list of transactions and errors.
function traceQueueIterator(
  trace: TraceTree.Trace,
  root: TraceTreeNode<TraceTree.NodeValue>,
  visitor: (
    parent: TraceTreeNode<TraceTree.NodeValue>,
    value: TraceTree.Transaction | TraceTree.TraceError
  ) => void
) {
  let tIdx = 0;
  let oIdx = 0;

  const tLen = trace.transactions.length;
  const oLen = trace.orphan_errors.length;

  const transactions = [...trace.transactions].sort(
    (a, b) => a.start_timestamp - b.start_timestamp
  );
  const orphan_errors = [...trace.orphan_errors].sort(
    (a, b) => (a?.timestamp ?? 0) - (b?.timestamp ?? 0)
  );
  // Items in each queue are sorted by timestamp, so we just take
  // from the queue with the earliest timestamp which means the final list will be ordered.
  while (tIdx < tLen || oIdx < oLen) {
    const transaction = transactions[tIdx];
    const orphan = orphan_errors[oIdx];

    if (transaction && orphan) {
      if (
        typeof orphan.timestamp === 'number' &&
        transaction.start_timestamp <= orphan.timestamp
      ) {
        visitor(root, transaction);
        tIdx++;
      } else {
        visitor(root, orphan);
        oIdx++;
      }
    } else if (transaction) {
      visitor(root, transaction);
      tIdx++;
    } else if (orphan) {
      visitor(root, orphan);
      oIdx++;
    }
  }
}

function traceChronologicalSort(
  a: TraceTreeNode<TraceTree.NodeValue>,
  b: TraceTreeNode<TraceTree.NodeValue>
) {
  return a.space[0] - b.space[0];
}

function getRelatedSpanErrorsFromTransaction(
  span: TraceTree.Span,
  node: TraceTreeNode<TraceTree.NodeValue>
): TraceTree.TraceError[] {
  if (!isTransactionNode(node) || !node.value?.errors?.length) {
    return [];
  }

  const errors: TraceTree.TraceError[] = [];
  for (const error of node.value.errors) {
    if (error.span === span.span_id) {
      errors.push(error);
    }
  }

  return errors;
}

// Returns a list of performance errors related to the txn with ids matching the span id
function getRelatedPerformanceIssuesFromTransaction(
  span: TraceTree.Span,
  node: TraceTreeNode<TraceTree.NodeValue>
): TraceTree.TracePerformanceIssue[] {
  if (!isTransactionNode(node) || !node.value?.performance_issues?.length) {
    return [];
  }

  const performanceIssues: TraceTree.TracePerformanceIssue[] = [];

  for (const perfIssue of node.value.performance_issues) {
    for (const s of perfIssue.span) {
      if (s === span.span_id) {
        performanceIssues.push(perfIssue);
      }
    }

    for (const suspect of perfIssue.suspect_spans) {
      if (suspect === span.span_id) {
        performanceIssues.push(perfIssue);
      }
    }
  }

  return performanceIssues;
}
