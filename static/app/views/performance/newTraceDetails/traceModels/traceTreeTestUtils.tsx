import {uuid4} from '@sentry/core';

import {EntryType, type Event, type EventTransaction} from 'sentry/types/event';
import type {
  TracePerformanceIssue,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';

import type {TraceMetaQueryResults} from '../traceApi/useTraceMeta';
import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isSpanNode,
  isTraceErrorNode,
  isTraceNode,
  isTransactionNode,
} from '../traceGuards';

import {ParentAutogroupNode} from './parentAutogroupNode';
import {SiblingAutogroupNode} from './siblingAutogroupNode';
import type {TraceTree} from './traceTree';
import type {TraceTreeNode} from './traceTreeNode';

export function makeEvent(
  overrides: Partial<Event> = {},
  spans: TraceTree.Span[] = []
): Event {
  return {
    entries: [{type: EntryType.SPANS, data: spans}],
    ...overrides,
  } as Event;
}

export function makeTrace(
  overrides: Partial<TraceSplitResults<TraceTree.Transaction>>
): TraceSplitResults<TraceTree.Transaction> {
  return {
    transactions: [],
    orphan_errors: [],
    ...overrides,
  } as TraceSplitResults<TraceTree.Transaction>;
}

export function makeEAPTrace(overrides: Partial<TraceTree.EAPTrace>): TraceTree.EAPTrace {
  return (overrides ?? []) as TraceTree.EAPTrace;
}

export function makeTransaction(
  overrides: Partial<TraceTree.Transaction> = {}
): TraceTree.Transaction {
  return {
    children: [],
    sdk_name: '',
    start_timestamp: 0,
    timestamp: 1,
    transaction: 'transaction',
    'transaction.op': 'transaction.op',
    'transaction.status': '',
    performance_issues: [],
    errors: [],
    ...overrides,
  } as TraceTree.Transaction;
}

export function makeSpan(overrides: Partial<TraceTree.Span> = {}): TraceTree.Span {
  return {
    span_id: overrides.span_id ?? uuid4(),
    op: 'span.op',
    description: 'span.description',
    start_timestamp: 0,
    timestamp: 10,
    data: {},
    trace_id: '',
    ...overrides,
  };
}

export function makeEAPSpan(
  overrides: Partial<TraceTree.EAPSpan> = {}
): TraceTree.EAPSpan {
  return {
    event_id: overrides.event_id ?? uuid4(),
    op: 'span.op',
    description: 'span.description',
    start_timestamp: 0,
    end_timestamp: 10,
    is_transaction: false,
    project_id: 1,
    project_slug: 'project_slug',
    transaction: 'span.transaction',
    parent_span_id: null,
    children: [],
    duration: 10,
    ...overrides,
  } as TraceTree.EAPSpan;
}

export function makeTraceError(
  overrides: Partial<TraceTree.TraceError> = {}
): TraceTree.TraceError {
  return {
    title: 'MaybeEncodingError: Error sending result',
    level: 'error',
    event_type: 'error',
    data: {},
    ...overrides,
  } as TraceTree.TraceError;
}

export function makeTracePerformanceIssue(
  overrides: Partial<TracePerformanceIssue> = {}
): TracePerformanceIssue {
  return {
    culprit: 'code',
    end: new Date().toISOString(),
    span: [],
    start: new Date().toISOString(),
    suspect_spans: ['sus span'],
    type: 0,
    issue_short_id: 'issue short id',
    ...overrides,
  } as TracePerformanceIssue;
}

export function makeTraceMetaQueryResults(
  overrides: Partial<TraceMetaQueryResults> = {}
): TraceMetaQueryResults {
  return {
    data: undefined,
    errors: [],
    isLoading: false,
    status: 'idle',
    ...overrides,
  } as TraceMetaQueryResults;
}

export function makeEventTransaction(
  overrides: Partial<Event> = {},
  spans: TraceTree.Span[] = []
): EventTransaction {
  return {
    contexts: {},
    tags: [],
    entries: [{type: EntryType.SPANS, data: spans}],
    ...overrides,
  } as EventTransaction;
}

export function makeParentAutogroup(
  overrides: Partial<TraceTree.ChildrenAutogroup> = {}
): TraceTree.ChildrenAutogroup {
  return {
    autogrouped_by: {
      op: overrides.op ?? 'op',
    },
    ...overrides,
  } as TraceTree.ChildrenAutogroup;
}

export function makeSiblingAutogroup(
  overrides: Partial<TraceTree.SiblingAutogroup> = {}
): TraceTree.SiblingAutogroup {
  return {
    autogrouped_by: {
      op: overrides.op ?? 'op',
      description: overrides.description ?? 'description',
    },
    ...overrides,
  } as TraceTree.SiblingAutogroup;
}

export function assertSpanNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): asserts node is TraceTreeNode<TraceTree.Span> {
  if (!isSpanNode(node)) {
    throw new Error('node is not a span');
  }
}

export function assertTraceNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): asserts node is TraceTreeNode<TraceTree.Trace> {
  if (!isTraceNode(node)) {
    throw new Error('node is not a trace');
  }
}

export function assertTransactionNode(
  node: TraceTreeNode<TraceTree.NodeValue> | null
): asserts node is TraceTreeNode<TraceTree.Transaction> {
  if (!node || !isTransactionNode(node)) {
    throw new Error('node is not a transaction');
  }
}

export function assertMissingInstrumentationNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): asserts node is TraceTreeNode<TraceTree.MissingInstrumentationSpan> {
  if (!isMissingInstrumentationNode(node)) {
    throw new Error('node is not a missing instrumentation node');
  }
}

export function assertTraceErrorNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): asserts node is TraceTreeNode<TraceTree.TraceError> {
  if (!isTraceErrorNode(node)) {
    throw new Error('node is not a trace error node');
  }
}

export function assertAutogroupedNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): asserts node is ParentAutogroupNode | SiblingAutogroupNode {
  if (!isAutogroupedNode(node)) {
    throw new Error('node is not a autogrouped node');
  }
}

export function assertParentAutogroupedNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): asserts node is ParentAutogroupNode {
  if (!(node instanceof ParentAutogroupNode)) {
    throw new Error('node is not a parent autogrouped node');
  }
}

export function assertSiblingAutogroupedNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): asserts node is ParentAutogroupNode {
  if (!(node instanceof SiblingAutogroupNode)) {
    throw new Error('node is not a parent node');
  }
}

export function makeNodeMetadata(
  overrides: Partial<TraceTree.Metadata> = {}
): TraceTree.Metadata {
  return {
    event_id: undefined,
    project_slug: undefined,
    ...overrides,
  };
}
