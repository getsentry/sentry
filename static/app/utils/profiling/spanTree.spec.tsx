import {EntrySpans, EventOrGroupType, EventTransaction} from 'sentry/types/event';

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
    const tree = new SpanTree(
      txn({
        title: 'transaction root',
        startTimestamp: Date.now(),
        endTimestamp: Date.now() + 1000,
      }),
      [
        s({span_id: '1', timestamp: 1, start_timestamp: 0}),
        s({span_id: '2', timestamp: 0.5, start_timestamp: 0}),
      ]
    );
    expect(tree.orphanedSpans.length).toBe(0);
    expect(tree.root.children[0].span.span_id).toBe('1');
    expect(tree.root.children[0].children[0].span.span_id).toBe('2');
  });
  it('pushes consecutive span', () => {
    const tree = new SpanTree(
      txn({
        title: 'transaction root',
        startTimestamp: Date.now(),
        endTimestamp: Date.now() + 1000,
      }),
      [
        s({span_id: '1', timestamp: 1, start_timestamp: 0}),
        s({span_id: '2', timestamp: 0.5, start_timestamp: 0}),
        s({span_id: '3', timestamp: 0.8, start_timestamp: 0.5}),
      ]
    );

    expect(tree.orphanedSpans.length).toBe(0);
    expect(tree.root.children[0].children[0].span.span_id).toBe('2');
    expect(tree.root.children[0].children[1].span.span_id).toBe('3');
  });
  it('marks span as orphaned if end overlaps', () => {
    const tree = new SpanTree(
      txn({
        title: 'transaction root',
        startTimestamp: Date.now(),
        endTimestamp: Date.now() + 1000,
      }),
      [
        s({span_id: '1', timestamp: 1, start_timestamp: 0}),
        s({span_id: '2', timestamp: 1.1, start_timestamp: 0.1}),
      ]
    );
    expect(tree.orphanedSpans[0].span_id).toBe('2');
  });
});
