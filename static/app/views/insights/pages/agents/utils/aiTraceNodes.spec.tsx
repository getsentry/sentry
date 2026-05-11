import {SpanFields} from 'sentry/views/insights/types';

import {hasError} from './aiTraceNodes';
import type {AITraceSpanNode} from './types';

function makeNode({
  errorCount = 0,
  spanStatus,
  status,
}: {
  errorCount?: number;
  spanStatus?: unknown;
  status?: unknown;
} = {}): AITraceSpanNode {
  const attributes: Record<string, unknown> = {};

  if (spanStatus !== undefined) {
    attributes[SpanFields.SPAN_STATUS] = spanStatus;
  }
  if (status !== undefined) {
    attributes.status = status;
  }

  return {
    errors: new Set(Array.from({length: errorCount}, (_, index) => index)),
    attributes,
  } as unknown as AITraceSpanNode;
}

describe('hasError', () => {
  it('returns true when node has explicit errors', () => {
    expect(hasError(makeNode({errorCount: 1}))).toBe(true);
  });

  it('uses span.status as authoritative when present', () => {
    const node = makeNode({spanStatus: 'ok', status: 'error'});
    expect(hasError(node)).toBe(false);
  });

  it('falls back to legacy status when span.status is missing', () => {
    const node = makeNode({status: 'error'});
    expect(hasError(node)).toBe(true);
  });
});
