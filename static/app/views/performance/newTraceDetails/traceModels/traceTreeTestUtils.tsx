import {uuid4} from '@sentry/core';

import {EntryType, type Event, type EventTransaction} from 'sentry/types/event';
import type {TraceSplitResults} from 'sentry/views/performance/newTraceDetails/traceApi/types';
import {
  isEAPSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';

import type {BaseNode} from './traceTreeNode/baseNode';
import type {EapSpanNode} from './traceTreeNode/eapSpanNode';
import type {TransactionNode} from './traceTreeNode/transactionNode';
import type {TraceTree} from './traceTree';

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
  return (overrides ?? [
    makeEAPSpan({
      event_id: 'eap-span-1',
      start_timestamp: 1,
      end_timestamp: 3,
      is_transaction: true,
      children: [
        makeEAPSpan({
          event_id: 'eap-span-2',
          start_timestamp: 2,
          end_timestamp: 3,
          is_transaction: false,
          children: [],
        }),
      ],
    }),
  ]) as TraceTree.EAPTrace;
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
    name: 'span.name',
    start_timestamp: 0,
    end_timestamp: 10,
    is_transaction: false,
    project_id: 1,
    project_slug: 'project_slug',
    transaction: 'span.transaction',
    parent_span_id: null,
    children: [],
    errors: [],
    occurrences: [],
    measurements: {},
    duration: 10,
    ...overrides,
  } as TraceTree.EAPSpan;
}

export function makeEAPError(
  overrides: Partial<TraceTree.EAPError> = {}
): TraceTree.EAPError {
  return {
    event_id: overrides.event_id ?? uuid4(),
    description: 'Test Error',
    start_timestamp: 0,
    project_id: 1,
    project_slug: 'project_slug',
    level: 'error',
    event_type: 'error',
    issue_id: 1,
    transaction: 'test error transaction',
    ...overrides,
  } as TraceTree.EAPError;
}

export function makeEAPOccurrence(
  overrides: Partial<TraceTree.EAPOccurrence> = {}
): TraceTree.EAPOccurrence {
  return {
    event_id: overrides.event_id ?? uuid4(),
    description: 'Test Occurence',
    start_timestamp: 0,
    project_id: 1,
    project_slug: 'project_slug',
    transaction: 'occurence.transaction',
    event_type: 'occurrence',
    issue_id: 1,
    level: 'info',
    culprit: 'code',
    short_id: 'short_id',
    type: 0,
    ...overrides,
  };
}

export function makeTraceError(
  overrides: Partial<TraceTree.TraceError> = {}
): TraceTree.TraceError {
  return {
    title: 'MaybeEncodingError: Error sending result',
    level: 'error',
    event_type: 'error',
    message: 'error message',
    data: {},
    ...overrides,
  } as TraceTree.TraceError;
}

export function makeTracePerformanceIssue(
  overrides: Partial<TraceTree.TracePerformanceIssue> = {}
): TraceTree.TracePerformanceIssue {
  return {
    culprit: 'code',
    end: new Date().toISOString(),
    span: [],
    start: new Date().toISOString(),
    suspect_spans: ['sus span'],
    type: 0,
    issue_short_id: 'issue short id',
    ...overrides,
  } as TraceTree.TracePerformanceIssue;
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
      name: overrides.name ?? 'name',
    },
    ...overrides,
  } as TraceTree.SiblingAutogroup;
}

export function assertTransactionNode(
  node: BaseNode | null
): asserts node is TransactionNode {
  if (!node || !isTransactionNode(node)) {
    throw new Error('node is not a transaction');
  }
}

export function assertEAPSpanNode(node: BaseNode | null): asserts node is EapSpanNode {
  if (!node || !isEAPSpanNode(node)) {
    throw new Error('node is not a eap span');
  }
}

export function makeUptimeCheck(
  overrides: Partial<TraceTree.UptimeCheck> = {}
): TraceTree.UptimeCheck {
  return {
    event_id: overrides.event_id ?? uuid4(),
    event_type: 'uptime_check',
    op: 'uptime.check',
    name: 'GET https://example.com',
    description: 'Uptime check for example.com',
    start_timestamp: 0,
    end_timestamp: 1,
    duration: 1,
    project_id: 1,
    project_slug: 'project_slug',
    children: [],
    errors: [],
    occurrences: [],
    additional_attributes: {
      dns_lookup_duration_us: '50000',
      dns_lookup_start_us: '0',
      tcp_connection_duration_us: '100000',
      tcp_connection_start_us: '50000',
      tls_handshake_duration_us: '200000',
      tls_handshake_start_us: '150000',
      send_request_duration_us: '25000',
      send_request_start_us: '350000',
      time_to_first_byte_duration_us: '500000',
      time_to_first_byte_start_us: '375000',
      receive_response_duration_us: '100000',
      receive_response_start_us: '875000',
    },
    ...overrides,
  } as TraceTree.UptimeCheck;
}

export function makeUptimeCheckTiming(
  overrides: Partial<TraceTree.UptimeCheckTiming> = {}
): TraceTree.UptimeCheckTiming {
  return {
    event_id: overrides.event_id ?? uuid4(),
    event_type: 'uptime_check_timing',
    op: 'dns.lookup.duration',
    description: 'DNS lookup',
    start_timestamp: 0,
    end_timestamp: 0.05,
    duration: 0.05,
    ...overrides,
  } as TraceTree.UptimeCheckTiming;
}

export function mockSpansResponse(
  spans: TraceTree.Span[],
  project_slug: string,
  event_id: string
): jest.Mock<any, any> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore MockApiClient is not defined in the global scope
  return MockApiClient.addMockResponse({
    url: `/organizations/org-slug/events/${project_slug}:${event_id}/?averageColumn=span.self_time&averageColumn=span.duration`,
    method: 'GET',
    body: makeEventTransaction({
      entries: [{type: EntryType.SPANS, data: spans}],
    }),
  });
}
