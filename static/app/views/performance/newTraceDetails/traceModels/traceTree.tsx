import * as Sentry from '@sentry/react';
import type {Location} from 'history';
import * as qs from 'query-string';

import type {Client} from 'sentry/api';
import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import type {Level, Measurement} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {
  TraceError as TraceErrorType,
  TraceFullDetailed,
  TracePerformanceIssue as TracePerformanceIssueType,
  TraceSplitResults,
} from 'sentry/views/performance/newTraceDetails/traceApi/types';
import {getTraceQueryParams} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {isTraceSplitResult} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {
  isEAPError,
  isEAPSpan,
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
  isTraceError,
  isUptimeCheck,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {
  collectTraceMeasurements,
  type RENDERABLE_MEASUREMENTS,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree.measurements';
import type {TracePreferencesState} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import type {ReplayTrace} from 'sentry/views/replays/detail/trace/useReplayTraces';
import type {HydratedReplayRecord} from 'sentry/views/replays/types';

import type {BaseNode} from './traceTreeNode/baseNode';
import {EapSpanNode} from './traceTreeNode/eapSpanNode';
import {ErrorNode} from './traceTreeNode/errorNode';
import {NoInstrumentationNode} from './traceTreeNode/noInstrumentationNode';
import {ParentAutogroupNode} from './traceTreeNode/parentAutogroupNode';
import {RootNode} from './traceTreeNode/rootNode';
import {SiblingAutogroupNode} from './traceTreeNode/siblingAutogroupNode';
import {TraceNode} from './traceTreeNode/traceNode';
import {TransactionNode} from './traceTreeNode/transactionNode';
import {UptimeCheckNode} from './traceTreeNode/uptimeCheckNode';
import {traceChronologicalSort} from './traceTreeNode/utils';
import {makeExampleTrace} from './makeExampleTrace';
import {TraceTreeEventDispatcher} from './traceTreeEventDispatcher';

const {info, fmt} = Sentry.logger;

/**
 *
 * This file implements the tree data structure that is used to represent a trace. We do
 * this both for performance reasons as well as flexibility. The requirement for a tree
 * is to support incremental patching and updates. This is important because we want to
 * be able to fetch more data as the user interacts with the tree, and we want to be able
 * efficiently update the tree as we receive more data.
 *
 * The trace is represented as a tree with different node value types (transaction, span, etc)
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

  type EAPError = {
    event_id: string;
    event_type: 'error';
    issue_id: number;
    level: Level;
    project_id: number;
    project_slug: string;
    start_timestamp: number;
    transaction: string;
    description?: string;
  };

  type EAPOccurrence = {
    culprit: string;
    description: string;
    event_id: string;
    event_type: 'occurrence';
    issue_id: number;
    level: Level;
    project_id: number;
    project_slug: string;
    start_timestamp: number;
    transaction: string;
    type: number;
    short_id?: string;
  };

  type EAPSpan = {
    children: EAPSpan[];
    duration: number;
    end_timestamp: number;
    errors: EAPError[];
    event_id: string;
    event_type: 'span';
    is_transaction: boolean;
    name: string;
    occurrences: EAPOccurrence[];
    op: string;
    parent_span_id: string | null;
    profile_id: string;
    profiler_id: string;
    project_id: number;
    project_slug: string;
    sdk_name: string;
    start_timestamp: number;
    transaction: string;
    transaction_id: string;
    additional_attributes?: Record<string, number | string>;
    description?: string;
    measurements?: Record<string, number>;
  };

  type UptimeCheck = {
    children: EAPSpan[];
    duration: number;
    end_timestamp: number;
    errors: EAPError[];
    event_id: string;
    event_type: 'uptime_check';
    name: string;
    occurrences: EAPOccurrence[];
    op: string;
    project_id: number;
    project_slug: string;
    start_timestamp: number;
    transaction: string;
    transaction_id: string;
    additional_attributes?: Record<string, number | string>;
    description?: string;
  };

  type UptimeCheckTiming = {
    duration: number;
    end_timestamp: number;
    event_id: string;
    event_type: 'uptime_check_timing';
    op: string;
    start_timestamp: number;
    description?: string;
  };

  // Raw node values
  interface Span extends RawSpanType {
    measurements?: Record<string, Measurement>;
  }

  interface Transaction extends TraceFullDetailed {
    profiler_id: string;
    sdk_name: string;
  }

  type EAPTrace = Array<EAPSpan | EAPError | UptimeCheck>;

  type Trace = TraceSplitResults<Transaction> | EAPTrace;

  type TraceError = TraceErrorType;
  type TraceErrorIssue = TraceError | EAPError;

  type TracePerformanceIssue = TracePerformanceIssueType;
  type TraceOccurrence = TracePerformanceIssue | EAPOccurrence;

  type TraceIssue = TraceErrorIssue | TraceOccurrence;

  type RepresentativeTraceEvent = {
    dataset: TraceItemDataset | null;
    event: BaseNode | OurLogsResponseItem | null;
  };

  type Profile = {profile_id: string} | {profiler_id: string};
  type Project = {
    slug: string;
  };
  type Root = null;

  // All possible node value types
  type NodeValue =
    | Trace
    | Transaction
    | TraceError
    | EAPError
    | Span
    | EAPSpan
    | UptimeCheck
    | UptimeCheckTiming
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

  interface BaseAutogroup {
    op: string;
    span_id: string;
    description?: string;
    name?: string;
  }

  interface SiblingAutogroup extends BaseAutogroup {
    autogrouped_by: {
      description: string;
      op: string;
    };
    type: 'sibling_autogroup';
  }

  interface ChildrenAutogroup extends BaseAutogroup {
    autogrouped_by: {
      op: string;
    };
    type: 'children_autogroup';
  }

  // All possible node types
  type Node = BaseNode;

  type NodeType =
    | 'txn'
    | 'span'
    | 'ag'
    | 'trace'
    | 'ms'
    | 'error'
    | 'empty'
    | 'uptime-check'
    | 'uptime-check-timing'
    | 'collapsed'
    | 'root';
  type NodePath = `${NodeType}-${string}`;

  type Metadata = {
    event_id: string | undefined;
    project_slug: string | undefined;
    // This is used to track the traceslug associated with a trace in a replay.
    // This is necessary because a replay has multiple traces and the current ui requires
    // us to merge them into one trace. We still need to keep track of the original traceSlug
    // to be able to fetch the correct trace-item details from EAP, in the trace drawer.
    replayTraceSlug?: string;
    spans?: number;
  };

  type OpsBreakdown = Array<{
    count: number;
    op: string;
  }>;

  type Indicator = {
    duration: number;
    label: string;
    measurement: Measurement;
    poor: boolean;
    start: number;
    type: keyof typeof RENDERABLE_MEASUREMENTS;
    score?: number;
  };

  type CollectedVital = {key: string; measurement: Measurement; score?: number};
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

function fetchTrace(
  api: Client,
  params: {
    orgSlug: string;
    query: string;
    traceId: string;
  },
  type: 'eap' | 'non-eap'
): Promise<TraceSplitResults<TraceTree.Transaction> | TraceTree.EAPTrace> {
  return api.requestPromise(
    type === 'eap'
      ? `/organizations/${params.orgSlug}/trace/${params.traceId}/?${params.query}`
      : `/organizations/${params.orgSlug}/events-trace/${params.traceId}/?${params.query}`
  );
}

export class TraceTree extends TraceTreeEventDispatcher {
  collapsed_nodes = 0;
  eap_spans_count = 0;
  projects = new Map<number, TraceTree.Project>();

  type: 'loading' | 'empty' | 'error' | 'trace' = 'trace';
  root: RootNode = new RootNode(null, null, null);

  vital_types: Set<'web' | 'mobile'> = new Set();
  vitals = new Map<BaseNode, TraceTree.CollectedVital[]>();

  profiled_events = new Set<BaseNode>();
  indicators: TraceTree.Indicator[] = [];

  list: BaseNode[] = [];

  static MISSING_INSTRUMENTATION_THRESHOLD_MS = 100;

  static Empty() {
    const tree = new TraceTree().build();
    tree.type = 'empty';
    return tree;
  }

  static Loading(metadata: TraceTree.Metadata, organization: Organization): TraceTree {
    const trace = makeExampleTrace(metadata, organization);
    trace.type = 'loading';
    trace.build();
    return trace;
  }

  static Error(metadata: TraceTree.Metadata, organization: Organization): TraceTree {
    const trace = makeExampleTrace(metadata, organization);
    trace.type = 'error';
    trace.build();
    return trace;
  }

  static ApplyPreferences(
    root: BaseNode,
    options: {
      organization: Organization;
      preferences?: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
    }
  ): void {
    if (options?.preferences?.missing_instrumentation) {
      TraceTree.DetectMissingInstrumentation(root);
    }

    if (options?.preferences?.autogroup.parent) {
      TraceTree.AutogroupDirectChildrenSpanNodes(root);
    }

    if (options?.preferences?.autogroup.sibling) {
      TraceTree.AutogroupSiblingSpanNodes(root, {organization: options.organization});
    }
  }

  static FromTrace(
    trace: TraceTree.Trace,
    options: {
      meta: TraceMetaQueryResults['data'] | null;
      organization: Organization;
      replay: HydratedReplayRecord | null;
      preferences?: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
      // This is used to track the traceslug associated with a trace in a replay.
      // This is necessary because a replay has multiple traces and the current ui requires
      // us to merge them into one trace. We still need to keep track of the original traceSlug
      // to be able to fetch the correct trace-item details from EAP, in the trace drawer.
      replayTraceSlug?: string;
    }
  ): TraceTree {
    const tree = new TraceTree();

    const traceNode = new TraceNode(tree.root, trace, {
      organization: options.organization,
      replayTraceSlug: options.replayTraceSlug,
    });

    function visit(
      parent: BaseNode,
      value:
        | TraceTree.Transaction
        | TraceTree.TraceError
        | TraceTree.EAPSpan
        | TraceTree.EAPError
        | TraceTree.UptimeCheck
    ) {
      tree.projects.set(value.project_id, {
        slug: value.project_slug,
      });

      let node: BaseNode;

      if (isEAPSpan(value)) {
        node = new EapSpanNode(parent, value, {
          organization: options.organization,
          replayTraceSlug: options.replayTraceSlug,
        });

        tree.eap_spans_count++;

        // We only want to add transactions as profiled events.
        if ((node as EapSpanNode).value.is_transaction && node.hasProfiles) {
          tree.profiled_events.add(node);
        }
      } else if (isUptimeCheck(value)) {
        node = new UptimeCheckNode(parent, value, {
          organization: options.organization,
          replayTraceSlug: options.replayTraceSlug,
        });
      } else if (isTraceError(value) || isEAPError(value)) {
        node = new ErrorNode(parent, value, {
          organization: options.organization,
          replayTraceSlug: options.replayTraceSlug,
        });
      } else {
        node = new TransactionNode(parent, value, {
          organization: options.organization,
          replayTraceSlug: options.replayTraceSlug,
          meta: options.meta,
        });

        // We only want to add transactions as profiled events.
        if (node.hasProfiles) {
          tree.profiled_events.add(node);
        }
      }

      if (node.canFetchChildren || !node.expanded) {
        tree.collapsed_nodes++;
      }

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

    traceNode.forEachChild(c => {
      traceSpaceBounds[0] = Math.min(traceSpaceBounds[0]!, c.space[0]);
      traceSpaceBounds[1] = Math.max(traceSpaceBounds[1]!, c.space[0] + c.space[1]);

      for (const error of c.errors) {
        traceNode.errors.add(error);
      }

      for (const occurrence of c.occurrences) {
        traceNode.occurrences.add(occurrence);
      }

      if (c.value && 'measurements' in c.value) {
        tree.indicators = tree.indicators.concat(
          collectTraceMeasurements(
            tree,
            c,
            c.space[0],
            c.measurements,
            tree.vitals,
            tree.vital_types
          )
        );
      }

      if (
        c.parent &&
        c.op === 'pageload' &&
        c.parent.op === 'http.server' &&
        c.parent.directVisibleChildren.filter(child => child.op === 'pageload').length ===
          1
      ) {
        //   // The swap can occur at a later point when new transactions are fetched,
        //   // which means we need to invalidate the tree and re-render the UI.
        const parent = c.parent.parent;
        TraceTree.Swap({parent: c.parent, child: c, reason: 'pageload server handler'});
        parent!.invalidate();
        parent!.forEachChild(child => {
          child.invalidate();
        });
      }
    });

    // The sum of all durations of traces that exist under a replay is not always
    // equal to the duration of the replay. We need to adjust the traceview bounds
    // to ensure that we can see the max of the replay duration and the sum(trace durations). This way, we
    // can ensure that the replay timestamp indicators are always visible in the traceview along with all spans from the traces.
    if (options.replay) {
      const replayStart = options.replay.started_at.getTime();
      const replayEnd = options.replay.finished_at.getTime();

      traceSpaceBounds[0] = Math.min(traceSpaceBounds[0]!, replayStart);
      traceSpaceBounds[1] = Math.max(traceSpaceBounds[1]!, replayEnd);
    }

    for (const indicator of tree.indicators) {
      // If any indicator starts after the trace ends, set end to the indicator start
      if (indicator.start > traceSpaceBounds[1]!) {
        traceSpaceBounds[1] = indicator.start;
      }
      // If an indicator starts before the trace start, set start to the indicator start
      if (indicator.start < traceSpaceBounds[0]!) {
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

    const space = [traceSpaceBounds[0]!, traceSpaceBounds[1]! - traceSpaceBounds[0]!];

    tree.root.space = [space[0]!, space[1]!];
    traceNode.space = [space[0]!, space[1]!];

    tree.indicators.sort((a, b) => a.start - b.start);

    TraceTree.ApplyPreferences(tree.root, options);

    return tree;
  }

  async fetchNodeSubTree(
    expanding: boolean,
    node: BaseNode,
    options: {
      api: Client;
      organization: Organization;
      preferences?: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
    }
  ) {
    const newBounds = await node.fetchChildren(expanding, this, {
      api: options.api,
    });

    // If the newly fetched children extend beyond the current bounds of the tree,
    // we need to extend the current bounds of the tree.
    if (newBounds) {
      const previousStart = this.root.space[0];
      const previousDuration = this.root.space[1];

      const newStart = newBounds[0];
      const newEnd = newBounds[0] + newBounds[1];

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

      if (options.preferences) {
        TraceTree.ApplyPreferences(node, options);
      }
    }

    this.build();
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

    for (const occurrence of additionalTraceNode.occurrences) {
      baseTraceNode.occurrences.add(occurrence);
    }

    for (const profiledEvent of tree.profiled_events) {
      this.profiled_events.add(profiledEvent);
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
            tree,
            node,
            baseTraceNode.space[0],
            node.measurements,
            this.vitals,
            this.vital_types
          )
        );
      }
    }

    // We need to invalidate the data in the last node of the tree
    // so that the connectors are updated and pointing to the sibling nodes
    const last = this.root.children[this.root.children.length - 1]!;
    last.invalidate();
    last.forEachChild(c => {
      c.invalidate();
    });

    const previousEnd = this.root.space[0] + this.root.space[1];
    const newEnd = tree.root.space[0] + tree.root.space[1];

    this.root.space[0] = Math.min(tree.root.space[0], this.root.space[0]);
    this.root.space[1] = Math.max(
      previousEnd - this.root.space[0],
      newEnd - this.root.space[0]
    );

    for (const child of tree.root.children) {
      this.list = this.list.concat(child.visibleChildren);
    }
  }

  static DetectMissingInstrumentation(root: BaseNode): number {
    let previous: BaseNode | null = null;
    let missingInstrumentationCount = 0;

    root.forEachChild(child => {
      const childSdkName = child.sdkName;
      const previousSdkName = previous ? previous.sdkName : undefined;

      if (
        previous &&
        child &&
        previous.allowNoInstrumentationNodes &&
        child.allowNoInstrumentationNodes &&
        shouldAddMissingInstrumentationSpan(childSdkName) &&
        shouldAddMissingInstrumentationSpan(previousSdkName) &&
        child.space[0] - previous.space[0] - previous.space[1] >=
          TraceTree.MISSING_INSTRUMENTATION_THRESHOLD_MS
      ) {
        const node = new NoInstrumentationNode(
          previous,
          child,
          child.parent,
          {
            type: 'missing_instrumentation',
            start_timestamp: previous.endTimestamp!,
            timestamp: child.startTimestamp!,
          },
          null
        );
        missingInstrumentationCount++;

        if (child.parent === previous) {
          // The tree is dfs iterated, so it can only ever be the first child
          previous.children.splice(0, 0, node);
          node.parent = previous;
        } else {
          const childIndex = child.parent?.children.indexOf(child) ?? -1;
          if (childIndex === -1) {
            Sentry.logger.error('Detecting missing instrumentation failed');
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
  static RemoveMissingInstrumentationNodes(root: BaseNode): number {
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

  static AutogroupDirectChildrenSpanNodes(root: BaseNode): number {
    const queue = [root];
    let autogroupCount = 0;

    while (queue.length > 0) {
      const node = queue.pop()!;

      if (!node.canAutogroup || node.children.length > 1) {
        for (const child of node.children) {
          queue.push(child);
        }
        continue;
      }

      const head = node;
      let tail = node;
      let groupMatchCount = 0;

      let errors: TraceTree.TraceErrorIssue[] = [];
      let occurrences: TraceTree.TraceOccurrence[] = [];

      let start = head.space[0];
      let end = head.space[0] + head.space[1];

      while (
        tail &&
        tail.children.length === 1 &&
        tail.children[0]!.canAutogroup &&
        // skip `op: default` spans as `default` is added to op-less spans:
        tail.children[0]!.op !== 'default' &&
        tail.children[0]!.op === head.op
      ) {
        start = Math.min(start, tail.space[0]);
        end = Math.max(end, tail.space[0] + tail.space[1]);

        errors = errors.concat(Array.from(tail.errors));
        occurrences = occurrences.concat(Array.from(tail.occurrences));

        groupMatchCount++;
        tail = tail.children[0]!;
      }

      if (groupMatchCount < 1) {
        for (const child of head.children) {
          queue.push(child);
        }
        continue;
      }

      if (!node.parent) {
        throw new Error('Parent node is missing, this should be unreachable code');
      }

      const children = node.parent.children;

      const index = children.indexOf(node);
      if (index === -1) {
        throw new Error('Node is not a child of its parent');
      }

      const autoGroupedNode = new ParentAutogroupNode(
        node.parent,
        {
          type: 'children_autogroup',
          span_id: head.id ?? '',
          op: head.op ?? '',
          description: head.description ?? '',
          autogrouped_by: {
            op: head.value && 'op' in head.value ? (head.value.op ?? '') : '',
          },
        },
        null,
        head,
        tail
      );

      autogroupCount++;
      children[index] = autoGroupedNode;

      autoGroupedNode.children = tail.children;
      autoGroupedNode.head.parent = autoGroupedNode;
      autoGroupedNode.groupCount = groupMatchCount + 1;

      // Checking the tail node for errors as it is not included in the grouping
      // while loop, but is hidden when the autogrouped node is collapsed
      errors = errors.concat(Array.from(tail.errors));
      occurrences = occurrences.concat(Array.from(tail.occurrences));

      start = Math.min(start, tail.space[0]);
      end = Math.max(end, tail.space[0] + tail.space[1]);

      autoGroupedNode.space = [start, end - start];
      autoGroupedNode.errors = new Set(errors);
      autoGroupedNode.occurrences = new Set(occurrences);

      for (const c of tail.children) {
        c.parent = autoGroupedNode;
        queue.push(c);
      }
    }

    return autogroupCount;
  }

  static RemoveDirectChildrenAutogroupNodes(root: BaseNode): number {
    let removeCount = 0;

    root.forEachChild(node => {
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

  static AutogroupSiblingSpanNodes(
    root: BaseNode,
    options: {
      organization: Organization;
    }
  ): number {
    const queue = [root];
    let autogroupCount = 0;

    while (queue.length > 0) {
      const node = queue.pop()!;

      queue.push(...node.getNextTraversalNodes());

      if (node.children.length < 5) {
        continue;
      }

      let index = 0;
      let matchCount = 0;

      while (index < node.children.length) {
        // Skip until we find a span candidate
        if (!node.children[index]!.canAutogroup) {
          index++;
          matchCount = 0;
          continue;
        }

        const current = node.children[index]!;
        const next = node.children[index + 1];

        if (
          next &&
          next.canAutogroup &&
          current.canAutogroup &&
          next.children.length === 0 &&
          current.children.length === 0 &&
          // skip `op: default` spans as `default` is added to op-less spans
          next.op !== 'default' &&
          next.op === current.op &&
          next.description === current.description
          // next.value.description === current.value.description
        ) {
          // console.log('are matching');
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
              type: 'sibling_autogroup',
              span_id: current.id ?? '',
              op: current.op ?? '',
              description: current.description,
              autogrouped_by: {
                op: current.op ?? '',
                description: current.description ?? '',
              },
            },
            {
              organization: options.organization,
            }
          );

          autogroupCount++;
          autoGroupedNode.groupCount = matchCount + 1;

          const start = index - matchCount;

          let start_timestamp = Number.POSITIVE_INFINITY;
          let timestamp = Number.NEGATIVE_INFINITY;

          for (let j = start; j < start + matchCount + 1; j++) {
            const child = node.children[j]!;

            start_timestamp = Math.min(start_timestamp, node.children[j]!.space[0]);
            timestamp = Math.max(
              timestamp,
              node.children[j]!.space[0] + node.children[j]!.space[1]
            );

            if (node.children[j]!.errors.size > 0) {
              for (const error of child.errors) {
                autoGroupedNode.errors.add(error);
              }
            }

            if (node.children[j]!.occurrences.size > 0) {
              for (const occurrence of node.children[j]!.occurrences) {
                autoGroupedNode.occurrences.add(occurrence);
              }
            }

            autoGroupedNode.children.push(node.children[j]!);
            node.children[j]!.parent = autoGroupedNode;
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

  static RemoveSiblingAutogroupNodes(root: BaseNode): number {
    let removeCount = 0;
    root.forEachChild(node => {
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

  // Removes node and all its children from the tree
  static Filter(node: BaseNode, predicate: (node: BaseNode) => boolean): BaseNode {
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

  static EnforceVisibility(tree: TraceTree, node: BaseNode): number {
    let index = tree.list.indexOf(node);

    if (node && index === -1) {
      let parent_node = node.parent;
      while (parent_node) {
        // Transactions break autogrouping chains, so we can stop here
        parent_node.expand(true, tree);
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
    const node = tree.root.findChild(n => n.matchById(eventId));

    if (!node) {
      return Promise.resolve();
    }

    return TraceTree.ExpandToPath(tree, node.pathToNode(), options);
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

    const transactionNodes = tree.root.findAllChildren(
      node => node.canFetchChildren && transactionIds.has(node.id ?? '')
    );

    const promises = transactionNodes.map(node =>
      tree.fetchNodeSubTree(true, node, {
        api: options.api,
        organization: options.organization,
        preferences: options.preferences,
      })
    );

    return Promise.all(promises)
      .then(_resp => {
        // Ignore response
      })
      .catch(e => {
        Sentry.withScope(scope => {
          scope.setFingerprint(['trace-view-expand-to-path-error']);
          scope.captureMessage('Failed to expand to path');
          info(fmt`Failed to expand to path`);
          scope.captureException(e);
        });
      });
  }

  // Only supports parent/child swaps (the only ones we need)
  // E.g. needed for swapping SSR spans: https://github.com/getsentry/rfcs/blob/main/text/0138-achieving-order-between-pageload-and-srr-spans.md
  static Swap({
    parent,
    child,
    reason,
  }: {
    child: BaseNode;
    parent: BaseNode;
    reason: BaseNode['reparent_reason'];
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

    // We need to sort the children of the child node as the swap may have broken the chronological order
    child.children.sort(traceChronologicalSort);
  }

  /**
   * Return a lazily calculated depth of the node in the tree.
   * Root node has a value of -1 as it is abstract.
   */
  static Depth(node: BaseNode): number {
    if (node.depth !== undefined) {
      return node.depth;
    }

    let depth = -2;
    let start: BaseNode | null = node;

    while (start) {
      depth++;
      start = start.parent;
    }

    node.depth = depth;
    return depth;
  }

  static ConnectorsTo(node: BaseNode): number[] {
    if (node.connectors !== undefined) {
      return node.connectors;
    }

    const connectors: number[] = [];
    let start: BaseNode | null = node.parent;

    if (start?.isRootNodeChild() && !node.isLastChild()) {
      node.connectors = [-TraceTree.Depth(node)];
      return node.connectors;
    }

    if (!node.isLastChild()) {
      connectors.push(TraceTree.Depth(node));
    }

    while (start) {
      if (!start.value || !start.parent) {
        break;
      }

      if (start.isLastChild()) {
        start = start.parent;
        continue;
      }

      connectors.push(
        start.parent.isRootNodeChild() ? -TraceTree.Depth(start) : TraceTree.Depth(start)
      );
      start = start.parent;
    }

    node.connectors = connectors;
    return connectors;
  }

  toList(): BaseNode[] {
    this.list = this.root.visibleChildren;
    return this.list;
  }

  rebuild() {
    this.root.invalidate();
    this.root.forEachChild(node => node.invalidate());
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

    const traceStats = {
      javascript_root_count: 0,
      orphan_errors_count: 0,
      orphan_spans_count: 0,
      roots_count: 0,
    };

    trace.children.forEach(node => {
      if (isRootEvent(node.value)) {
        traceStats.roots_count++;

        if (isJavascriptSDKEvent(node.value)) {
          traceStats.javascript_root_count++;
        }
      } else {
        if (isTraceError(node.value) || isEAPError(node.value)) {
          traceStats.orphan_errors_count++;
        } else {
          traceStats.orphan_spans_count++;
        }
      }
    });

    if (traceStats.roots_count === 0) {
      if (traceStats.orphan_spans_count > 0) {
        return TraceShape.NO_ROOT;
      }

      if (traceStats.orphan_errors_count > 0) {
        return TraceShape.ONLY_ERRORS;
      }

      return TraceShape.EMPTY_TRACE;
    }

    if (traceStats.roots_count === 1) {
      if (traceStats.orphan_spans_count > 0) {
        return TraceShape.BROKEN_SUBTRACES;
      }

      return TraceShape.ONE_ROOT;
    }

    if (traceStats.roots_count > 1) {
      if (traceStats.javascript_root_count > 0) {
        return TraceShape.BROWSER_MULTIPLE_ROOTS;
      }

      return TraceShape.MULTIPLE_ROOTS;
    }

    throw new Error('Not a valid trace');
  }

  findRepresentativeTraceNode({logs}: {logs: OurLogsResponseItem[] | undefined}): {
    dataset: TraceItemDataset | null;
    event: BaseNode | OurLogsResponseItem | null;
  } | null {
    const hasLogs = logs && logs.length > 0;
    if (this.type === 'empty' && hasLogs) {
      return {
        event: logs[0]!,
        dataset: TraceItemDataset.LOGS,
      };
    }

    const traceNode = this.root.children[0];

    if (this.type !== 'trace' || !traceNode) {
      return null;
    }

    let preferredRootEvent: BaseNode | null = null;
    let firstRootEvent: BaseNode | null = null;
    let candidateEvent: BaseNode | null = null;
    let firstEvent: BaseNode | null = null;

    for (const node of traceNode.children) {
      if (isRootEvent(node.value)) {
        if (!firstRootEvent) {
          firstRootEvent = node;
        }

        if (hasPreferredOp(node)) {
          preferredRootEvent = node;
          break;
        }
        // Otherwise we keep looking for a root eap transaction. If we don't find one, we use other roots, like standalone spans.
        continue;
      } else if (
        // If we haven't found a root transaction, but we found a candidate transaction
        // with an op that we care about, we can use it for the title. We keep looking for
        // a root.
        !candidateEvent &&
        hasPreferredOp(node)
      ) {
        candidateEvent = node;
        continue;
      } else if (!firstEvent) {
        // If we haven't found a root or candidate transaction, we can use the first transaction
        // in the trace for the title.
        firstEvent = node;
      }
    }

    const event = preferredRootEvent ?? firstRootEvent ?? candidateEvent ?? firstEvent;
    return {
      event,
      dataset: event?.traceItemDataset ?? null,
    };
  }

  fetchAdditionalTraces(options: {
    api: Client;
    filters: any;
    meta: TraceMetaQueryResults | null;
    organization: Organization;
    replayTraces: ReplayTrace[];
    rerender: () => void;
    type: 'eap' | 'non-eap';
    urlParams: Location['query'];
    preferences?: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
  }): () => void {
    let cancelled = false;
    const {organization, api, urlParams, filters, rerender, replayTraces} = options;
    const clonedTraceIds = [...replayTraces];

    const root = this.root.children[0]!;
    root.fetchStatus = 'loading';
    rerender();

    (async () => {
      while (clonedTraceIds.length > 0) {
        const batch = clonedTraceIds.splice(0, 3);
        const results = await Promise.allSettled(
          batch.map(batchTraceData => {
            return fetchTrace(
              api,
              {
                orgSlug: organization.slug,
                query: qs.stringify(
                  getTraceQueryParams(options.type, urlParams, filters.selection, {
                    timestamp: batchTraceData.timestamp,
                  })
                ),
                traceId: batchTraceData.traceSlug,
              },
              options.type
            );
          })
        );

        if (cancelled) {
          return;
        }

        results.forEach((result, index) => {
          const traceSlug = batch[index]?.traceSlug;
          // Ignoring the error case for now
          if (result.status === 'fulfilled') {
            this.appendTree(
              TraceTree.FromTrace(result.value, {
                meta: options.meta?.data,
                replay: null,
                preferences: options.preferences,
                replayTraceSlug: traceSlug,
                organization,
              })
            );
            rerender();
          }
        });
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
        .map(trace => printTraceTreeNode(trace, 0))
        .filter(Boolean)
        .join('\n') +
      '\n'
    );
  }
}

function printTraceTreeNode(node: BaseNode, offset: number): string {
  // +1 because we may be printing from the root which is -1 indexed
  const padding = '  '.repeat(TraceTree.Depth(node) + offset);
  return padding + node.printNode();
}

// Double queue iterator to merge transactions and errors into a single list ordered by timestamp
// without having to reallocate the potentially large list of transactions and errors.
function traceQueueIterator(
  trace: TraceTree.Trace,
  root: BaseNode,
  visitor: (
    parent: BaseNode,
    value:
      | TraceTree.Transaction
      | TraceTree.TraceError
      | TraceTree.EAPSpan
      | TraceTree.EAPError
      | TraceTree.UptimeCheck
  ) => void
) {
  if (!isTraceSplitResult(trace)) {
    // Eap spans are not sorted by default
    const spans = [...trace].sort((a, b) => a.start_timestamp - b.start_timestamp);
    for (const span of spans) {
      visitor(root, span);
    }
    return;
  }

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

const CANDIDATE_TRACE_TITLE_OPS = ['pageload', 'navigation', 'ui.load'];

/**
 * Prefer "special" root events over generic root events when generating a title
 * for the waterfall view. Picking these improves contextual navigation for linked
 * traces, resulting in more meaningful waterfall titles.
 */
function hasPreferredOp(node: BaseNode): boolean {
  const op = node.op;
  return !!op && CANDIDATE_TRACE_TITLE_OPS.includes(op);
}

function shouldAddMissingInstrumentationSpan(sdk: string | undefined): boolean {
  if (!sdk) {
    return true;
  }
  if (sdk.length < 'sentry.javascript.'.length) {
    return true;
  }

  switch (sdk.toLowerCase()) {
    case 'sentry.javascript.browser':
    case 'sentry.javascript.react':
    case 'sentry.javascript.gatsby':
    case 'sentry.javascript.ember':
    case 'sentry.javascript.vue':
    case 'sentry.javascript.angular':
    case 'sentry.javascript.angular-ivy':
    case 'sentry.javascript.nextjs':
    case 'sentry.javascript.nuxt':
    case 'sentry.javascript.electron':
    case 'sentry.javascript.remix':
    case 'sentry.javascript.svelte':
    case 'sentry.javascript.sveltekit':
    case 'sentry.javascript.react-native':
    case 'sentry.javascript.astro':
      return false;
    case undefined:
      return true;
    default:
      return true;
  }
}

function isJavascriptSDKEvent(value: TraceTree.NodeValue): boolean {
  return (
    !!value &&
    'sdk_name' in value &&
    /javascript|angular|astro|backbone|ember|gatsby|nextjs|react|remix|svelte|vue/.test(
      value.sdk_name
    )
  );
}

function isRootEvent(value: TraceTree.NodeValue): boolean {
  // Root events has no parent_span_id
  return !!value && 'parent_span_id' in value && value.parent_span_id === null;
}
