import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';

export function Span(params = {}): RawSpanType {
  return {
    timestamp: 1657201239.51,
    start_timestamp: 1657201239.503,
    op: 'ui.load',
    span_id: 'a385d9fd52e0c4bc',
    parent_span_id: 'bdf1a9fae2062311',
    trace_id: '4d5c2e2102234a7d94102b4f1e41c2bb',
    data: {},
    ...params,
  };
}
