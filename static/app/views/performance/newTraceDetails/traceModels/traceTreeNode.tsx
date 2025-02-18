import type {Theme} from '@emotion/react';

import type {EventTransaction} from 'sentry/types/event';

import type {TraceTree} from './traceTree';

function isTraceTransaction(value: TraceTree.NodeValue): value is TraceTree.Transaction {
  return !!(value && 'transaction' in value);
}

function isTraceError(value: TraceTree.NodeValue): value is TraceTree.TraceError {
  return !!(value && 'level' in value);
}

function isTraceSpan(value: TraceTree.NodeValue): value is TraceTree.Span {
  return !!(
    value &&
    'span_id' in value &&
    !isTraceAutogroup(value) &&
    !isTraceTransaction(value)
  );
}

function isTraceAutogroup(
  value: TraceTree.NodeValue
): value is TraceTree.ChildrenAutogroup | TraceTree.SiblingAutogroup {
  return !!(value && 'autogrouped_by' in value);
}

function shouldCollapseNodeByDefault(node: TraceTreeNode<TraceTree.NodeValue>) {
  if (isTraceSpan(node.value)) {
    // Android creates TCP connection spans which are noisy and not useful in most cases.
    // Unless the span has a child txn which would indicate a continuaton of the trace, we collapse it.
    if (node.value.op === 'http.client' && node.value.origin === 'auto.http.okhttp') {
      return true;
    }
  }

  return false;
}

export class TraceTreeNode<T extends TraceTree.NodeValue = TraceTree.NodeValue> {
  parent: TraceTreeNode | null = null;
  reparent_reason: 'pageload server handler' | null = null;

  fetchStatus: 'resolved' | 'error' | 'idle' | 'loading' = 'idle';
  value: T;

  canFetch = false;
  expanded = true;
  zoomedIn = false;

  metadata: TraceTree.Metadata = {
    project_slug: undefined,
    event_id: undefined,
    spans: undefined,
  };

  event: EventTransaction | null = null;

  // Events associated with the node, these are inferred from the node value.
  errors = new Set<TraceTree.TraceError>();
  performance_issues = new Set<TraceTree.TracePerformanceIssue>();
  profiles: TraceTree.Profile[] = [];

  space: [number, number] = [0, 0];
  children: TraceTreeNode[] = [];

  depth: number | undefined;
  connectors: number[] | undefined;

  constructor(parent: TraceTreeNode | null, value: T, metadata: TraceTree.Metadata) {
    this.parent = parent ?? null;
    this.value = value;
    this.metadata = metadata;

    // The node can fetch its children if it has more than one span, or if we failed to fetch the span count.
    this.canFetch =
      typeof metadata.spans === 'number'
        ? metadata.spans > 1
        : isTraceTransaction(this.value);

    // If a node has both a start and end timestamp, then we can infer a duration,
    // otherwise we can only infer a timestamp.
    if (
      value &&
      'timestamp' in value &&
      'start_timestamp' in value &&
      typeof value.timestamp === 'number' &&
      typeof value.start_timestamp === 'number'
    ) {
      this.space = [
        value.start_timestamp * 1e3,
        (value.timestamp - value.start_timestamp) * 1e3,
      ];
    } else if (value && 'timestamp' in value && typeof value.timestamp === 'number') {
      this.space = [value.timestamp * 1e3, 0];
    }

    if (value) {
      if ('errors' in value && Array.isArray(value.errors)) {
        value.errors.forEach(error => this.errors.add(error));
      }

      if ('performance_issues' in value && Array.isArray(value.performance_issues)) {
        value.performance_issues.forEach(issue => this.performance_issues.add(issue));
      }

      if ('profile_id' in value && typeof value.profile_id === 'string') {
        this.profiles.push({profile_id: value.profile_id});
      }
      if ('profiler_id' in value && typeof value.profiler_id === 'string') {
        this.profiles.push({profiler_id: value.profiler_id});
      }
    }

    // For error nodes, its value is the only associated issue.
    if (isTraceError(this.value)) {
      this.errors.add(this.value);
    }

    // Android http spans generate sub spans for things like dns resolution in http requests,
    // which creates a lot of noise and is not useful to display.
    if (shouldCollapseNodeByDefault(this)) {
      this.expanded = false;
    }
  }

  get hasErrors(): boolean {
    return this.errors.size > 0 || this.performance_issues.size > 0;
  }

  private _max_severity: keyof Theme['level'] | undefined;
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

  invalidate() {
    this.connectors = undefined;
    this.depth = undefined;
  }

  static Root() {
    return new TraceTreeNode(null, null, {
      event_id: undefined,
      project_slug: undefined,
    });
  }
}
