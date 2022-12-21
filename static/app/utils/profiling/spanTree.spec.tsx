import {EntrySpans} from 'sentry/types/event';

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

describe('SpanTree', () => {
  it('appends to parent that contains span', () => {
    const tree = new SpanTree([
      s({span_id: '1', timestamp: 1, start_timestamp: 0}),
      s({span_id: '2', timestamp: 0.5, start_timestamp: 0}),
    ]);
    expect(tree.orphanedSpans.length).toBe(0);
    expect(tree.root.children[0].span.span_id).toBe('1');
    expect(tree.root.children[0].children[0].span.span_id).toBe('2');
  });
  it('pushes consecutive span', () => {
    const tree = new SpanTree([
      s({span_id: '1', timestamp: 1, start_timestamp: 0}),
      s({span_id: '2', timestamp: 0.5, start_timestamp: 0}),
      s({span_id: '3', timestamp: 0.8, start_timestamp: 0.5}),
    ]);

    expect(tree.orphanedSpans.length).toBe(0);
    expect(tree.root.children[0].children[0].span.span_id).toBe('2');
    expect(tree.root.children[0].children[1].span.span_id).toBe('3');
  });
  it('marks span as orphaned if end overlaps', () => {
    const tree = new SpanTree([
      s({span_id: '1', timestamp: 1, start_timestamp: 0}),
      s({span_id: '2', timestamp: 1.1, start_timestamp: 0.1}),
    ]);
    expect(tree.orphanedSpans[0].span_id).toBe('2');
  });
});
