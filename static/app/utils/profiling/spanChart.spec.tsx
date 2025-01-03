import type {EntrySpans, EventTransaction} from 'sentry/types/event';
import {EventOrGroupType} from 'sentry/types/event';
import {SpanChart} from 'sentry/utils/profiling/spanChart';
import {SpanTree} from 'sentry/utils/profiling/spanTree';

import {Rect} from './speedscope';

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
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        contexts: {trace: {span_id: 'root'}},
        startTimestamp: start + 0,
        endTimestamp: start + 1,
      }),
      [
        s({
          span_id: '1',
          parent_span_id: 'root',
          timestamp: start + 1,
          start_timestamp: start,
        }),
        s({
          span_id: '2',
          parent_span_id: '1',
          timestamp: start + 0.5,
          start_timestamp: start,
        }),
        s({
          span_id: '3',
          parent_span_id: '2',
          timestamp: start + 0.2,
          start_timestamp: start,
        }),
        s({
          span_id: '4',
          parent_span_id: '1',
          timestamp: start + 1,
          start_timestamp: start + 0.5,
        }),
      ]
    );

    expect(tree.root.children[0]!.children[1]!.span.span_id).toBe('4');
    const chart = new SpanChart(tree);

    chart.forEachSpanOfTree(chart.spanTrees[0]!, 0, span => {
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
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        contexts: {trace: {span_id: 'root'}},
        startTimestamp: start + 0,
        endTimestamp: start + 10,
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
          parent_span_id: '2',
          timestamp: start + 1,
          start_timestamp: start,
        }),
      ]
    );

    const chart = new SpanChart(tree);
    expect(chart.minSpanDuration).toBe(1 * 1e3);
  });

  it('tracks chart depth', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        contexts: {trace: {span_id: 'root'}},
        startTimestamp: start + 0,
        endTimestamp: start + 1,
      }),
      [
        s({
          span_id: '1',
          parent_span_id: 'root',
          timestamp: start + 1,
          start_timestamp: start,
        }),
        s({
          span_id: '2',
          parent_span_id: '1',
          timestamp: start + 0.5,
          start_timestamp: start,
        }),
        s({
          span_id: '3',
          parent_span_id: '2',
          timestamp: start + 0.2,
          start_timestamp: start,
        }),
        s({
          span_id: '4',
          parent_span_id: '3',
          timestamp: start + 0.1,
          start_timestamp: start,
        }),
      ]
    );

    const chart = new SpanChart(tree);
    expect(chart.depth).toBe(4);
  });

  it('initializes configSpace', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        contexts: {trace: {span_id: 'root'}},
        startTimestamp: start + 0,
        endTimestamp: start + 10,
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
          parent_span_id: '2',
          timestamp: start + 1,
          start_timestamp: start,
        }),
      ]
    );

    const chart = new SpanChart(tree);
    expect(chart.configSpace.equals(new Rect(0, 0, 10 * 1e3, 3))).toBe(true);
  });

  it('remaps spans to start of benchmark', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        contexts: {trace: {span_id: 'root'}},
        startTimestamp: start + 5,
        endTimestamp: start + 10,
      }),
      [
        s({
          span_id: '1',
          parent_span_id: 'root',
          timestamp: start + 10,
          start_timestamp: start + 6,
        }),
        s({
          span_id: '2',
          parent_span_id: '1',
          timestamp: start + 9,
          start_timestamp: start + 8,
        }),
      ]
    );

    const chart = new SpanChart(tree);
    expect(chart.spans[1]!.start).toBe(1 * 1e3);
    expect(chart.spans[1]!.end).toBe(5 * 1e3);

    expect(chart.spans[2]!.start).toBe(3 * 1e3);
    expect(chart.spans[2]!.end).toBe(4 * 1e3);
  });

  it('converts durations to final unit', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        contexts: {trace: {span_id: 'root'}},
        startTimestamp: start + 1,
        endTimestamp: start + 11,
      }),
      [
        s({
          span_id: '1',
          parent_span_id: 'root',
          timestamp: start + 4,
          start_timestamp: start + 2,
        }),
      ]
    );

    const chart = new SpanChart(tree, {unit: 'nanoseconds'});
    expect(chart.spans[1]!.start).toBe(1 * 1e9);
    expect(chart.spans[1]!.end).toBe(3 * 1e9);
    expect(chart.spans[1]!.duration).toBe(2 * 1e9);

    expect(chart.configSpace.height).toBe(1);
    expect(chart.configSpace.width).toBe(10 * 1e9);
  });

  it('does not infinitely loop if a span is truly orphaned', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        contexts: {trace: {span_id: 'root'}},
        startTimestamp: start + 0,
        endTimestamp: start + 10,
      }),
      [
        // If a span belongs to nothing, we dont render it,
        // for now we only render spans that ultimately belong
        // to the transaction when the parent_span_id is followed
        s({
          span_id: '1',
          parent_span_id: 'root',
          timestamp: start + 10,
          start_timestamp: start,
        }),
        s({
          span_id: '2',
          parent_span_id: undefined,
          timestamp: start + 10,
          start_timestamp: start,
        }),
      ]
    );

    const chart = new SpanChart(tree);
    expect(chart.spanTrees).toHaveLength(2);
  });

  it('creates a new tree from orphaned spans', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        contexts: {trace: {span_id: 'root'}},
        startTimestamp: start + 0,
        endTimestamp: start + 10,
      }),
      [
        // These two spans overlap and as first is inserted,
        // the 2nd span can no longer be inserted and the parent_span_id
        // edge is no longer satisfied
        s({
          span_id: '1',
          parent_span_id: 'root',
          timestamp: start + 10,
          start_timestamp: start,
        }),
        s({
          span_id: '2',
          parent_span_id: 'root',
          timestamp: start + 10,
          start_timestamp: start,
        }),
      ]
    );

    const chart = new SpanChart(tree);
    expect(chart.spanTrees).toHaveLength(2);

    // Even though they belong to the same root,
    // the spans are offset visually by the tree height
    expect(chart.spans[1]!.depth).toBe(1);
    expect(chart.spans[2]!.depth).toBe(2);
  });
});
