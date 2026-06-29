import type {SpanNodeData, TransactionSpanData} from 'sentry/utils/profiling/spanTree';
import {SpanTree} from 'sentry/utils/profiling/spanTree';
import {SpanFields} from 'sentry/views/insights/types';

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

describe('SpanTree', () => {
  it('initializes the root to txn', () => {
    const transaction = txn({
      [SpanFields.SPAN_DESCRIPTION]: 'transaction root',
      [SpanFields.PRECISE_START_TS]: Date.now(),
      [SpanFields.PRECISE_FINISH_TS]: Date.now() + 1000,
    });
    const tree = new SpanTree(transaction, []);
    expect(tree.root.span[SpanFields.PRECISE_START_TS]).toBe(
      transaction[SpanFields.PRECISE_START_TS]
    );
    expect(tree.root.span[SpanFields.PRECISE_FINISH_TS]).toBe(
      transaction[SpanFields.PRECISE_FINISH_TS]
    );
  });
  it('appends to parent that contains span', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        [SpanFields.SPAN_DESCRIPTION]: 'transaction root',
        [SpanFields.PRECISE_START_TS]: start,
        [SpanFields.PRECISE_FINISH_TS]: start + 10,
        [SpanFields.SPAN_ID]: 'root',
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
      ]
    );
    expect(tree.orphanedSpans).toHaveLength(0);
    expect(tree.root.children[0]!.span[SpanFields.SPAN_ID]).toBe('1');
    expect(tree.root.children[0]!.children[0]!.span[SpanFields.SPAN_ID]).toBe('2');
  });

  it('checks for span overlaps that contains span', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        [SpanFields.SPAN_DESCRIPTION]: 'transaction root',
        [SpanFields.PRECISE_START_TS]: start,
        [SpanFields.PRECISE_FINISH_TS]: start + 10,
        [SpanFields.SPAN_ID]: 'root',
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
          [SpanFields.TRACE_PARENT_SPAN]: '1',
          [SpanFields.PRECISE_FINISH_TS]: start + 6,
          [SpanFields.PRECISE_START_TS]: start + 1,
        }),
      ]
    );

    expect(tree.orphanedSpans).toHaveLength(1);
    expect(tree.root.children[0]!.span[SpanFields.SPAN_ID]).toBe('1');
    expect(tree.root.children[0]!.children[0]!.span[SpanFields.SPAN_ID]).toBe('2');
    expect(tree.root.children[0]!.children[1]).toBeUndefined();
  });

  it('creates missing instrumentation node', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        [SpanFields.SPAN_DESCRIPTION]: 'transaction root',
        [SpanFields.PRECISE_START_TS]: start,
        [SpanFields.PRECISE_FINISH_TS]: start + 10,
        [SpanFields.SPAN_ID]: 'root',
      }),
      [
        s({
          [SpanFields.SPAN_ID]: '1',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 5,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '2',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 10,
          [SpanFields.PRECISE_START_TS]: start + 6,
        }),
      ]
    );
    expect(tree.orphanedSpans).toHaveLength(0);
    expect(tree.root.children[0]!.span[SpanFields.SPAN_ID]).toBe('1');
    expect(tree.root.children[1]!.span[SpanFields.SPAN_OP]).toBe(
      'missing span instrumentation'
    );
    expect(tree.root.children[2]!.span[SpanFields.SPAN_ID]).toBe('2');
  });

  it('does not create missing instrumentation if elapsed < threshold', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        [SpanFields.SPAN_DESCRIPTION]: 'transaction root',
        [SpanFields.PRECISE_START_TS]: start,
        [SpanFields.PRECISE_FINISH_TS]: start + 10,
        [SpanFields.SPAN_ID]: 'root',
      }),
      [
        s({
          [SpanFields.SPAN_ID]: '1',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 5,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '2',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 10,
          // There is only 50ms difference here, 100ms is the threshold
          [SpanFields.PRECISE_START_TS]: start + 5.05,
        }),
      ]
    );
    expect(tree.root.children[0]!.span[SpanFields.SPAN_ID]).toBe('1');
    expect(tree.root.children[1]!.span[SpanFields.SPAN_ID]).toBe('2');
  });

  it('pushes consecutive span', () => {
    const start = Date.now();
    const tree = new SpanTree(
      txn({
        [SpanFields.SPAN_DESCRIPTION]: 'transaction root',
        [SpanFields.PRECISE_START_TS]: start,
        [SpanFields.PRECISE_FINISH_TS]: start + 1000,
        [SpanFields.SPAN_ID]: 'root',
      }),
      [
        s({
          [SpanFields.SPAN_ID]: '1',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 0.05,
          [SpanFields.PRECISE_START_TS]: start,
        }),
        s({
          [SpanFields.SPAN_ID]: '2',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: start + 0.08,
          [SpanFields.PRECISE_START_TS]: start + 0.05,
        }),
      ]
    );

    expect(tree.orphanedSpans).toHaveLength(0);
    expect(tree.root.children[0]!.span[SpanFields.SPAN_ID]).toBe('1');
    expect(tree.root.children[1]!.span[SpanFields.SPAN_ID]).toBe('2');
  });
  it('marks span as orphaned if parent_id does not match', () => {
    const tree = new SpanTree(
      txn({
        [SpanFields.SPAN_DESCRIPTION]: 'transaction root',
        [SpanFields.PRECISE_START_TS]: Date.now(),
        [SpanFields.PRECISE_FINISH_TS]: Date.now() + 1000,
        [SpanFields.SPAN_ID]: 'root',
      }),
      [
        s({
          [SpanFields.SPAN_ID]: '1',
          [SpanFields.TRACE_PARENT_SPAN]: 'root',
          [SpanFields.PRECISE_FINISH_TS]: 1,
          [SpanFields.PRECISE_START_TS]: 0,
        }),
        s({
          [SpanFields.SPAN_ID]: '2',
          [SpanFields.TRACE_PARENT_SPAN]: 'orphaned',
          [SpanFields.PRECISE_FINISH_TS]: 1.1,
          [SpanFields.PRECISE_START_TS]: 0.1,
        }),
      ]
    );
    expect(tree.orphanedSpans[0]![SpanFields.SPAN_ID]).toBe('2');
  });
});
