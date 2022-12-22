import {EntrySpans, EventOrGroupType, EventTransaction} from 'sentry/types/event';
import {SpanChart} from 'sentry/utils/profiling/spanChart';
import {SpanTree} from 'sentry/utils/profiling/spanTree';

import {Rect} from './gl/utils';

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

describe('spanChart', () => {
  it('iterates over all spans with depth', () => {
    const tree = new SpanTree(txn({startTimestamp: 0, endTimestamp: 1}), [
      s({span_id: '1', timestamp: 1, start_timestamp: 0}),
      s({span_id: '2', timestamp: 0.5, start_timestamp: 0}),
      s({span_id: '3', timestamp: 0.2, start_timestamp: 0}),
      s({span_id: '4', timestamp: 1, start_timestamp: 0.5}),
    ]);

    expect(tree.root.children[0].children[1].span.span_id).toBe('4');

    const chart = new SpanChart(tree);

    chart.forEachSpan(span => {
      if (span.node.span.span_id === '1') {
        expect(span.depth).toBe(1);
      } else if (span.node.span.span_id === '2') {
        expect(span.depth).toBe(2);
      } else if (span.node.span.span_id === '3') {
        expect(span.depth).toBe(3);
      } else if (span.node.span.span_id === '4') {
        expect(span.depth).toBe(2);
      }
    });
  });

  it('keeps track of shortest duration span', () => {
    const tree = new SpanTree(txn({startTimestamp: 0, endTimestamp: 10}), [
      s({span_id: '1', timestamp: 10, start_timestamp: 0}),
      s({span_id: '2', timestamp: 5, start_timestamp: 0}),
      s({span_id: '3', timestamp: 1, start_timestamp: 0}),
    ]);

    const chart = new SpanChart(tree);
    expect(chart.minSpanDuration).toBe(1);
  });

  it('tracks chart depth', () => {
    const tree = new SpanTree(txn({startTimestamp: 0, endTimestamp: 1}), [
      s({span_id: '1', timestamp: 1, start_timestamp: 0}),
      s({span_id: '2', timestamp: 0.5, start_timestamp: 0}),
      s({span_id: '3', timestamp: 0.2, start_timestamp: 0}),
      s({span_id: '4', timestamp: 0.1, start_timestamp: 0}),
    ]);

    const chart = new SpanChart(tree);
    expect(chart.depth).toBe(4);
  });

  it('initializes configSpace', () => {
    const tree = new SpanTree(txn({startTimestamp: 0, endTimestamp: 10}), [
      s({span_id: '1', timestamp: 10, start_timestamp: 0}),
      s({span_id: '2', timestamp: 5, start_timestamp: 0}),
      s({span_id: '3', timestamp: 1, start_timestamp: 0}),
    ]);

    const chart = new SpanChart(tree);
    expect(chart.configSpace.equals(new Rect(0, 0, 10, 3))).toBe(true);
  });

  it('remaps spans to start of benchmark', () => {
    const tree = new SpanTree(txn({startTimestamp: 5, endTimestamp: 10}), [
      s({span_id: '1', timestamp: 10, start_timestamp: 6}),
      s({span_id: '2', timestamp: 9, start_timestamp: 8}),
    ]);

    const chart = new SpanChart(tree);
    expect(chart.spans[1].start).toBe(1);
    expect(chart.spans[1].end).toBe(5);

    expect(chart.spans[2].start).toBe(3);
    expect(chart.spans[2].end).toBe(4);
  });

  it('converts durations to final unit', () => {
    const tree = new SpanTree(txn({startTimestamp: 1, endTimestamp: 11}), [
      s({span_id: '1', timestamp: 4, start_timestamp: 2}),
    ]);

    const chart = new SpanChart(tree, {unit: 'nanoseconds'});
    expect(chart.spans[1].start).toBe(1 * 1e6);
    expect(chart.spans[1].end).toBe(3 * 1e6);
    expect(chart.spans[1].duration).toBe(2 * 1e6);

    expect(chart.configSpace.height).toBe(1);
    expect(chart.configSpace.width).toBe(10 * 1e6);
  });
});
