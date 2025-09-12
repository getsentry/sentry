import type {Theme} from '@emotion/react';

import type {Client} from 'sentry/api';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import type {Organization} from 'sentry/types/organization';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';
import type {TracePreferencesState} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';

export interface TraceTreeNodeExtra {
  organization: Organization;
  // This is used to track the traceslug associated with a trace in a replay.
  // This is necessary because a replay has multiple traces and the current ui requires
  // us to merge them into one trace. We still need to keep track of the original traceSlug
  // to be able to fetch the correct trace-item details from EAP, in the trace drawer.
  replayTraceSlug?: string;
}

export abstract class BaseNode<T extends TraceTree.NodeValue = TraceTree.NodeValue> {
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
   * Whether this node can be autogrouped.
   */
  canAutogroup = false;

  /**
   * The breakdown of the node's operations.
   */
  opsBreakdown: TraceTree.OpsBreakdown = [];

  /**
   * The errors associated with the node.
   */
  errors = new Set<TraceTree.TraceErrorIssue>();

  /**
   * The occurrences associated with the node, mainly performance issues.
   */
  occurrences = new Set<TraceTree.TraceOccurrence>();

  /**
   * The profiles associated with the node.
   */
  profiles = new Set<TraceTree.Profile>();

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
  extra: TraceTreeNodeExtra;

  // TODO Abdullah Khan: Replace the type of traceNode with TraceNode type once we have it
  constructor(parent: BaseNode | null, value: T, extra: TraceTreeNodeExtra) {
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

      if (
        'profile_id' in value &&
        typeof value.profile_id === 'string' &&
        value.profile_id.trim() !== ''
      ) {
        this.profiles.add({profile_id: value.profile_id});
      }
      if (
        'profiler_id' in value &&
        typeof value.profiler_id === 'string' &&
        value.profiler_id.trim() !== ''
      ) {
        this.profiles.add({profiler_id: value.profiler_id});
      }
    }
  }

  get id(): string | undefined {
    return this.value && 'event_id' in this.value ? this.value.event_id : undefined;
  }

  get op(): string | undefined {
    return this.value && 'op' in this.value ? this.value.op : undefined;
  }

  get projectSlug(): string | undefined {
    return this.value && 'project_slug' in this.value
      ? this.value.project_slug
      : undefined;
  }

  get description(): string | undefined {
    return this.value && 'description' in this.value ? this.value.description : undefined;
  }

  /**
   * The start timestamp of the node in seconds.
   */
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

  get hasIssues(): boolean {
    return this.errors.size > 0 || this.occurrences.size > 0;
  }

  get visibleChildren(): BaseNode[] {
    const queue: BaseNode[] = [];
    const visibleChildren: BaseNode[] = [];
    if (this.expanded) {
      for (let i = this.children.length - 1; i >= 0; i--) {
        queue.push(this.children[i]!);
      }
    }

    while (queue.length > 0) {
      const node = queue.pop()!;

      visibleChildren.push(node);

      // iterate in reverse to ensure nodes are processed in order
      if (node.expanded) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          queue.push(node.children[i]!);
        }
      }
    }

    return visibleChildren;
  }

  get directChildren(): BaseNode[] {
    return this.children;
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

  expand(expanding: boolean, tree: TraceTree): boolean {
    const index = tree.list.indexOf(this as any);

    // Expanding is not allowed for zoomed in nodes
    if (expanding === this.expanded || this.hasFetchedChildren) {
      return false;
    }

    if (expanding) {
      // Flip expanded so that we can collect visible children
      this.expanded = expanding;

      // Flip expanded so that we can collect visible children
      tree.list.splice(index + 1, 0, ...(this.visibleChildren as any));
    } else {
      tree.list.splice(index + 1, this.visibleChildren.length);

      this.expanded = expanding;
    }

    TraceTree.invalidate(this as any, true);
    return true;
  }

  /**
   * Makes the color of the node's bar in the waterfall.
   */
  makeBarColor(theme: Theme): string {
    return pickBarColor('default', theme);
  }

  fetchChildren(
    _fetching: boolean,
    _tree: TraceTree,
    _options: {
      api: Client;
      preferences: TracePreferencesState;
    }
  ): Promise<any> {
    return Promise.resolve(null);
  }

  abstract get drawerTabsTitle(): string;

  abstract get traceHeaderTitle(): {
    title: string;
    subtitle?: string;
  };

  abstract pathToNode(): TraceTree.NodePath[];

  abstract analyticsName(): string;

  /**
   * Prints the node in a human readable format for debugging purposes. Used in snapshot tests.
   */
  abstract printNode(): string;

  abstract renderWaterfallRow<NodeType extends TraceTree.Node = TraceTree.Node>(
    props: TraceRowProps<NodeType>
  ): React.ReactNode;

  abstract renderDetails<NodeType extends TraceTreeNode<TraceTree.NodeValue>>(
    props: TraceTreeNodeDetailsProps<NodeType>
  ): React.ReactNode;

  abstract matchWithFreeText(key: string): boolean;
}
