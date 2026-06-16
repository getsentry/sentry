import {SpanChart} from 'sentry/utils/profiling/spanChart';
import type {SpanNodeData, TransactionSpanData} from 'sentry/utils/profiling/spanTree';
import {SpanTree} from 'sentry/utils/profiling/spanTree';
import {SpanFields} from 'sentry/views/insights/types';

import {Rect} from './speedscope';

function s(partial: Partial<SpanNodeData> = {}): SpanNodeData {
  return {
    [SpanFields.PRECISE_FINISH_TS]: 0,
    [SpanFields.PRECISE_START_TS]: 0,
    [SpanFields.SPAN_DESCRIPTION]: '',
    [SpanFields.SPAN_OP]: '',
    [SpanFields.SPAN_ID]: '',
    [SpanFields.TRACE_PARENT_SPAN]: '',
    [SpanFields.TRACE]: '',
    [SpanFields.TRACE_STATUS]: '',
    [SpanFields.TRANSACTION_EVENT_ID]: '',
    ...partial,
  };
}

function txn(partial: Partial<TransactionSpanData> = {}): TransactionSpanData {
  return {
    [SpanFields.SPAN_DESCRIPTION]: '',
    [SpanFields.PRECISE_START_TS]: Date.now(),
    [SpanFields.PRECISE_FINISH_TS]: Date.now() + 1000,
    [SpanFields.SPAN_ID]: '',
    [SpanFields.SPAN_SELF_TIME]: 0,
    [SpanFields.TRACE]: '',
    [SpanFields.SDK_NAME]: '',
    [SpanFields.TRANSACTION_EVENT_ID]: '',
    ...partial,
  };
}

describe('spanChart', () => {
  it('iterates over all spans with depth', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        [SpanFields.SPAN_ID]: 'root',
        [SpanFields.PRECISE_START_TS]: start + 0,
        [SpanFields.PRECISE_FINISH_TS]: start + 1,
      }),
      [
        s({
          [SpanFields.SPAN_ID]: '1',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 1,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '2',
          [SpanFields.TRACE_PARENT_SPAN]: '1',
          [SpanFields.PRECISE_FINISH_TS]: start + 0.5,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '3',
          [SpanFields.TRACE_PARENT_SPAN]: '2',
          [SpanFields.PRECISE_FINISH_TS]: start + 0.2,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '4',
          [SpanFields.TRACE_PARENT_SPAN]: '1',
          [SpanFields.PRECISE_FINISH_TS]: start + 1,
          [SpanFields.PRECISE_START_TS]: start + 0.5,
        }),
      ]
    );

    expect(tree.root.children[0]!.children[1]!.span[SpanFields.SPAN_ID]).toBe('4');
    const chart = new SpanChart(tree);

    chart.forEachSpanOfTree(chart.spanTrees[0]!, 0, span => {
      if (span.node.span[SpanFields.SPAN_ID] === '1') {
        expect(span.depth).toBe(1);
      } else if (span.node.span[SpanFields.SPAN_ID] === '2') {
        expect(span.depth).toBe(2);
      } else if (span.node.span[SpanFields.SPAN_ID] === '3') {
        expect(span.depth).toBe(3);
      } else if (span.node.span[SpanFields.SPAN_ID] === '4') {
        expect(span.depth).toBe(2);
      }
    });
  });

  it('keeps track of shortest duration span', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        [SpanFields.SPAN_ID]: 'root',
        [SpanFields.PRECISE_START_TS]: start + 0,
        [SpanFields.PRECISE_FINISH_TS]: start + 10,
      }),
      [
        s({
          [SpanFields.SPAN_ID]: '1',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 10,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '2',
          [SpanFields.TRACE_PARENT_SPAN]: '1',
          [SpanFields.PRECISE_FINISH_TS]: start + 5,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '3',
          [SpanFields.TRACE_PARENT_SPAN]: '2',
          [SpanFields.PRECISE_FINISH_TS]: start + 1,
          [SpanFields.PRECISE_START_TS]: start,
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
        [SpanFields.SPAN_ID]: 'root',
        [SpanFields.PRECISE_START_TS]: start + 0,
        [SpanFields.PRECISE_FINISH_TS]: start + 1,
      }),
      [
        s({
          [SpanFields.SPAN_ID]: '1',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 1,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '2',
          [SpanFields.TRACE_PARENT_SPAN]: '1',
          [SpanFields.PRECISE_FINISH_TS]: start + 0.5,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '3',
          [SpanFields.TRACE_PARENT_SPAN]: '2',
          [SpanFields.PRECISE_FINISH_TS]: start + 0.2,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '4',
          [SpanFields.TRACE_PARENT_SPAN]: '3',
          [SpanFields.PRECISE_FINISH_TS]: start + 0.1,
          [SpanFields.PRECISE_START_TS]: start,
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
        [SpanFields.SPAN_ID]: 'root',
        [SpanFields.PRECISE_START_TS]: start + 0,
        [SpanFields.PRECISE_FINISH_TS]: start + 10,
      }),
      [
        s({
          [SpanFields.SPAN_ID]: '1',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 10,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '2',
          [SpanFields.TRACE_PARENT_SPAN]: '1',
          [SpanFields.PRECISE_FINISH_TS]: start + 5,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '3',
          [SpanFields.TRACE_PARENT_SPAN]: '2',
          [SpanFields.PRECISE_FINISH_TS]: start + 1,
          [SpanFields.PRECISE_START_TS]: start,
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
        [SpanFields.SPAN_ID]: 'root',
        [SpanFields.PRECISE_START_TS]: start + 5,
        [SpanFields.PRECISE_FINISH_TS]: start + 10,
      }),
      [
        s({
          [SpanFields.SPAN_ID]: '1',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 10,
          [SpanFields.PRECISE_START_TS]: start + 6,
        }),
        s({
          [SpanFields.SPAN_ID]: '2',
          [SpanFields.TRACE_PARENT_SPAN]: '1',
          [SpanFields.PRECISE_FINISH_TS]: start + 9,
          [SpanFields.PRECISE_START_TS]: start + 8,
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
        [SpanFields.SPAN_ID]: 'root',
        [SpanFields.PRECISE_START_TS]: start + 1,
        [SpanFields.PRECISE_FINISH_TS]: start + 11,
      }),
      [
        s({
          [SpanFields.SPAN_ID]: '1',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 4,
          [SpanFields.PRECISE_START_TS]: start + 2,
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
        [SpanFields.SPAN_ID]: 'root',
        [SpanFields.PRECISE_START_TS]: start + 0,
        [SpanFields.PRECISE_FINISH_TS]: start + 10,
      }),
      [
        // If a span belongs to nothing, we dont render it,
        // for now we only render spans that ultimately belong
        // to the transaction when the parent_span_id is followed
        s({
          [SpanFields.SPAN_ID]: '1',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 10,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '2',
          [SpanFields.TRACE_PARENT_SPAN]: '',
          [SpanFields.PRECISE_FINISH_TS]: start + 10,
          [SpanFields.PRECISE_START_TS]: start,
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
        [SpanFields.SPAN_ID]: 'root',
        [SpanFields.PRECISE_START_TS]: start + 0,
        [SpanFields.PRECISE_FINISH_TS]: start + 10,
      }),
      [
        // These two spans overlap and as first is inserted,
        // the 2nd span can no longer be inserted and the parent_span_id
        // edge is no longer satisfied
        s({
          [SpanFields.SPAN_ID]: '1',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 10,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '2',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 10,
          [SpanFields.PRECISE_START_TS]: start,
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
