import type {Theme} from '@emotion/react';

import type {Client} from 'sentry/api';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import type {Organization} from 'sentry/types/organization';
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';
import type {TracePreferencesState} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';

export interface TraceTreeNodeExtra {
  organization: Organization;
  meta?: TraceMetaQueryResults['data'] | null;
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
   * Whether this should be considered when detecting no instrumentation between spans.
   */
  allowNoInstrumentationNodes = false;

  /**
   * Whether this node can be autogrouped.
   */
  canAutogroup = false;

  /**
   * Can show details in the trace drawer.
   */
  canShowDetails = true;

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
  extra: TraceTreeNodeExtra | null;

  /**
   * Whether the node is an EAP event.
   */
  isEAPEvent = false;

  /**
   * The priority of the node in when we find multiple nodes matching the same search query.
   */
  searchPriority = 0;

  /**
   * The maximum severity of the node's issues.
   */
  private _max_severity: keyof Theme['level'] | undefined;

  constructor(parent: BaseNode | null, value: T, extra: TraceTreeNodeExtra | null) {
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

  get projectId(): number | undefined {
    return this.value && 'project_id' in this.value ? this.value.project_id : undefined;
  }

  get description(): string | undefined {
    return this.value && 'description' in this.value ? this.value.description : undefined;
  }

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
      for (let i = this.directChildren.length - 1; i >= 0; i--) {
        queue.push(this.directChildren[i]!);
      }
    }

    while (queue.length > 0) {
      const node = queue.pop()!;

      visibleChildren.push(node);

      // iterate in reverse to ensure nodes are processed in order
      if (node.expanded || node.visibleChildren.length > 0) {
        for (let i = node.directChildren.length - 1; i >= 0; i--) {
          queue.push(node.directChildren[i]!);
        }
      }
    }

    return visibleChildren;
  }

  get directChildren(): BaseNode[] {
    return this.children;
  }

  get maxIssueSeverity(): keyof Theme['level'] {
    if (this._max_severity) {
      return this._max_severity;
    }

    for (const error of this.errors) {
      if (error.level === 'error' || error.level === 'fatal') {
        this._max_severity = error.level;
        return this.maxIssueSeverity;
      }
    }

    return 'default';
  }

  get path(): TraceTree.NodePath {
    return `${this.type}-${this.id}`;
  }

  isRootNodeChild(): boolean {
    return this.parent?.value === null;
  }

  isLastChild(): boolean {
    if (!this.parent) {
      return false;
    }

    const visibleChildren = this.parent.visibleChildren;
    return visibleChildren[visibleChildren.length - 1] === this;
  }

  hasVisibleChildren(): boolean {
    return this.visibleChildren.length > 0;
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

  getNextTraversalNodes(): BaseNode[] {
    return this.children;
  }

  findChild(predicate: (child: BaseNode) => boolean): BaseNode | null {
    const queue: BaseNode[] = [...this.getNextTraversalNodes()];

    while (queue.length > 0) {
      const next = queue.pop()!;

      if (predicate(next)) {
        return next;
      }

      const children = next.getNextTraversalNodes();
      for (let i = children.length - 1; i >= 0; i--) {
        queue.push(children[i]!);
      }
    }

    return null;
  }

  findAllChildren(predicate: (child: BaseNode) => boolean): BaseNode[] {
    const queue: BaseNode[] = [...this.getNextTraversalNodes()];
    const results: BaseNode[] = [];

    while (queue.length > 0) {
      const next = queue.pop()!;

      if (predicate(next)) {
        results.push(next);
      }

      const children = next.getNextTraversalNodes();
      for (let i = children.length - 1; i >= 0; i--) {
        queue.push(children[i]!);
      }
    }

    return results;
  }

  forEachChild(callback: (child: BaseNode) => void) {
    const queue: BaseNode[] = [...this.getNextTraversalNodes()];

    while (queue.length > 0) {
      const next = queue.pop()!;

      callback(next);

      const children = next.getNextTraversalNodes();
      for (let i = children.length - 1; i >= 0; i--) {
        queue.push(children[i]!);
      }
    }
  }

  findParent(predicate: (parent: BaseNode) => boolean): BaseNode | null {
    let current = this.parent;
    while (current) {
      if (predicate(current)) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  expand(expanding: boolean, tree: TraceTree): boolean {
    const index = tree.list.indexOf(this);

    // Expanding is not allowed for zoomed in nodes
    if (expanding === this.expanded || this.hasFetchedChildren) {
      return false;
    }

    if (expanding) {
      // Flip expanded so that we can collect visible children
      this.expanded = expanding;

      // Flip expanded so that we can collect visible children
      tree.list.splice(index + 1, 0, ...this.visibleChildren);
    } else {
      tree.list.splice(index + 1, this.visibleChildren.length);

      this.expanded = expanding;
    }

    this.invalidate();
    this.forEachChild(child => child.invalidate());
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
      preferences: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
    }
  ): Promise<any> {
    return Promise.resolve(null);
  }

  pathToNode(): TraceTree.NodePath[] {
    const path = this.path;

    if (!path) {
      return [];
    }

    const closestFetchableParent = this.findParent(p => p.canFetchChildren);

    if (closestFetchableParent) {
      return [path, ...closestFetchableParent.pathToNode()];
    }

    return [path];
  }

  abstract get type(): TraceTree.NodeType;

  abstract matchByPath(path: TraceTree.NodePath): boolean;

  abstract get drawerTabsTitle(): string;

  abstract get traceHeaderTitle(): {
    title: string;
    subtitle?: string;
  };

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
