import {EntrySpans} from 'sentry/types/event';
import {SpanChart} from 'sentry/utils/profiling/spanChart';
import {SpanTree} from 'sentry/utils/profiling/spanTree';

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

it('iterates over all spans with depth', () => {
  const tree = new SpanTree([
    s({span_id: '1', timestamp: 1, start_timestamp: 0}),
    s({span_id: '2', timestamp: 0.5, start_timestamp: 0}),
    s({span_id: '3', timestamp: 0.2, start_timestamp: 0}),
    s({span_id: '4', timestamp: 1, start_timestamp: 0.5}),
  ]);

  expect(tree.spanTree.children[0].children[1].span.span_id).toBe('4');

  const chart = new SpanChart(tree);

  chart.forEachSpan(span => {
    if (span.node.span.span_id === '1') {
      expect(span.depth).toBe(0);
    } else if (span.node.span.span_id === '2') {
      expect(span.depth).toBe(1);
    } else if (span.node.span.span_id === '3') {
      expect(span.depth).toBe(2);
    } else if (span.node.span.span_id === '4') {
      expect(span.depth).toBe(1);
    }
  });
});
