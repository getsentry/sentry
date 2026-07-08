import {SpanFields} from 'sentry/views/insights/types';

import {getToolInputPreview, hasError} from './aiTraceNodes';
import type {AITraceSpanNode} from './types';

function makeToolNode(toolInput?: unknown): AITraceSpanNode {
  const attributes: Record<string, unknown> = {};
  if (toolInput !== undefined) {
    attributes['gen_ai.tool.call.arguments'] =
      typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput);
  }
  return {errors: new Set(), attributes} as unknown as AITraceSpanNode;
}

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

describe('getToolInputPreview', () => {
  it('returns undefined when there is no tool input', () => {
    expect(getToolInputPreview(makeToolNode())).toBeUndefined();
  });

  it('renders multiple object keys as `key: value` pairs', () => {
    const node = makeToolNode({path: 'src/foo.ts', limit: 10, recursive: true});
    expect(getToolInputPreview(node)).toBe(
      'path: "src/foo.ts", limit: 10, recursive: true'
    );
  });

  it('caps the preview at four keys', () => {
    const node = makeToolNode({a: 1, b: 2, c: 3, d: 4, e: 5});
    expect(getToolInputPreview(node)).toBe('a: 1, b: 2, c: 3, d: 4');
  });

  it('truncates long string values', () => {
    const node = makeToolNode({query: 'x'.repeat(60)});
    const preview = getToolInputPreview(node)!;
    expect(preview.startsWith('query: "')).toBe(true);
    expect(preview).toContain('...');
    expect(preview.length).toBeLessThan(60);
  });

  it('previews non-object JSON (array) as a truncated string', () => {
    const node = makeToolNode(['a', 'b', 'c']);
    expect(getToolInputPreview(node)).toBe('["a","b","c"]');
  });

  it('falls back to the raw string for invalid JSON', () => {
    const node = makeToolNode('not json');
    expect(getToolInputPreview(node)).toBe('not json');
  });

  it('returns undefined for an empty object', () => {
    expect(getToolInputPreview(makeToolNode({}))).toBeUndefined();
  });
});

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
