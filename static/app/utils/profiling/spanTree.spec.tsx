import type {EntrySpans, EventTransaction} from 'sentry/types/event';
import {EventOrGroupType} from 'sentry/types/event';

import {SpanTree} from './spanTree';

function s(partial: Partial<EntrySpans['data'][0]>): EntrySpans['data'][0] {
  return {
    timestamp: 0,
    start_timestamp: 0,
    exclusive_time: 0,
    description: '',
    op: '',
    span_id: '',
    parent_span_id: '',
    trace_id: '',
    hash: '',
    data: {},
    ...partial,
  };
}

function txn(partial: Partial<EventTransaction>): EventTransaction {
  return {
    id: '',
    projectID: '',
    user: {},
    contexts: {},
    entries: [],
    errors: [],
    dateCreated: '',
    startTimestamp: Date.now(),
    endTimestamp: Date.now() + 1000,
    title: '',
    type: EventOrGroupType.TRANSACTION,
    culprit: '',
    dist: null,
    eventID: '',
    fingerprints: [],
    dateReceived: new Date().toISOString(),
    message: '',
    metadata: {},
    size: 0,
    tags: [],
    occurrence: null,
    location: '',
    crashFile: null,
    ...partial,
  };
}

describe('SpanTree', () => {
  it('initializes the root to txn', () => {
    const transaction = txn({
      title: 'transaction root',
      startTimestamp: Date.now(),
      endTimestamp: Date.now() + 1000,
    });
    const tree = new SpanTree(transaction, []);
    expect(tree.root.span.start_timestamp).toBe(transaction.startTimestamp);
    expect(tree.root.span.timestamp).toBe(transaction.endTimestamp);
  });
  it('appends to parent that contains span', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        title: 'transaction root',
        startTimestamp: start,
        endTimestamp: start + 10,
        contexts: {trace: {span_id: 'root'}},
      }),
      [
        s({
          span_id: '1',
          parent_span_id: 'root',
          timestamp: start + 10,
          start_timestamp: start,
        }),
        s({
          span_id: '2',
          parent_span_id: '1',
          timestamp: start + 5,
          start_timestamp: start,
        }),
      ]
    );
    expect(tree.orphanedSpans).toHaveLength(0);
    expect(tree.root.children[0]!.span.span_id).toBe('1');
    expect(tree.root.children[0]!.children[0]!.span.span_id).toBe('2');
  });

  it('checks for span overlaps that contains span', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        title: 'transaction root',
        startTimestamp: start,
        endTimestamp: start + 10,
        contexts: {trace: {span_id: 'root'}},
      }),
      [
        s({
          span_id: '1',
          parent_span_id: 'root',
          timestamp: start + 10,
          start_timestamp: start,
        }),
        s({
          span_id: '2',
          parent_span_id: '1',
          timestamp: start + 5,
          start_timestamp: start,
        }),
        s({
          span_id: '3',
          parent_span_id: '1',
          timestamp: start + 6,
          start_timestamp: start + 1,
        }),
      ]
    );

    expect(tree.orphanedSpans).toHaveLength(1);
    expect(tree.root.children[0]!.span.span_id).toBe('1');
    expect(tree.root.children[0]!.children[0]!.span.span_id).toBe('2');
    expect(tree.root.children[0]!.children[1]).toBeUndefined();
  });

  it('creates missing instrumentation node', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        title: 'transaction root',
        startTimestamp: start,
        endTimestamp: start + 10,
        contexts: {trace: {span_id: 'root'}},
      }),
      [
        s({
          span_id: '1',
          parent_span_id: 'root',
          timestamp: start + 5,
          start_timestamp: start,
        }),
        s({
          span_id: '2',
          parent_span_id: 'root',
          timestamp: start + 10,
          start_timestamp: start + 6,
        }),
      ]
    );
    expect(tree.orphanedSpans).toHaveLength(0);
    expect(tree.root.children[0]!.span.span_id).toBe('1');
    expect(tree.root.children[1]!.span.op).toBe('missing span instrumentation');
    expect(tree.root.children[2]!.span.span_id).toBe('2');
  });

  it('does not create missing instrumentation if elapsed < threshold', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        title: 'transaction root',
        startTimestamp: start,
        endTimestamp: start + 10,
        contexts: {trace: {span_id: 'root'}},
      }),
      [
        s({
          span_id: '1',
          parent_span_id: 'root',
          timestamp: start + 5,
          start_timestamp: start,
        }),
        s({
          span_id: '2',
          parent_span_id: 'root',
          timestamp: start + 10,
          // There is only 50ms difference here, 100ms is the threshold
          start_timestamp: start + 5.05,
        }),
      ]
    );
    expect(tree.root.children[0]!.span.span_id).toBe('1');
    expect(tree.root.children[1]!.span.span_id).toBe('2');
  });

  it('pushes consecutive span', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        title: 'transaction root',
        startTimestamp: start,
        endTimestamp: start + 1000,
        contexts: {trace: {span_id: 'root'}},
      }),
      [
        s({
          span_id: '1',
          parent_span_id: 'root',
          timestamp: start + 0.05,
          start_timestamp: start,
        }),
        s({
          span_id: '2',
          parent_span_id: 'root',
          timestamp: start + 0.08,
          start_timestamp: start + 0.05,
        }),
      ]
    );

    expect(tree.orphanedSpans).toHaveLength(0);
    expect(tree.root.children[0]!.span.span_id).toBe('1');
    expect(tree.root.children[1]!.span.span_id).toBe('2');
  });
  it('marks span as orphaned if parent_id does not match', () => {
    const tree = new SpanTree(
      txn({
        title: 'transaction root',
        startTimestamp: Date.now(),
        endTimestamp: Date.now() + 1000,
        contexts: {trace: {span_id: 'root'}},
      }),
      [
        s({span_id: '1', parent_span_id: 'root', timestamp: 1, start_timestamp: 0}),
        s({
          span_id: '2',
          parent_span_id: 'orphaned',
          timestamp: 1.1,
          start_timestamp: 0.1,
        }),
      ]
    );
    expect(tree.orphanedSpans[0]!.span_id).toBe('2');
  });
});
