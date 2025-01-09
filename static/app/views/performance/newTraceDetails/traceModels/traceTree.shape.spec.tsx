import {TraceShape, TraceTree} from './traceTree';
import {makeTrace, makeTraceError, makeTransaction} from './traceTreeTestUtils';

describe('TraceTree', () => {
  it('empty trace', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [],
        orphan_errors: [],
      }),
      {replay: null, meta: null}
    );

    expect(tree.shape).toBe(TraceShape.EMPTY_TRACE);
  });

  it('no root', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            children: [],
          }),
          makeTransaction({
            children: [],
          }),
        ],
        orphan_errors: [],
      }),
      {replay: null, meta: null}
    );

    expect(tree.shape).toBe(TraceShape.NO_ROOT);
  });

  it('one root', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            parent_span_id: null,
            children: [],
          }),
        ],
        orphan_errors: [],
      }),
      {replay: null, meta: null}
    );

    expect(tree.shape).toBe(TraceShape.ONE_ROOT);
  });

  it('broken subtrees', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            parent_span_id: null,
            children: [],
          }),
          makeTransaction({
            children: [],
          }),
        ],
        orphan_errors: [],
      }),
      {replay: null, meta: null}
    );

    expect(tree.shape).toBe(TraceShape.BROKEN_SUBTRACES);
  });

  it('browser multiple roots shape', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({sdk_name: 'javascript', parent_span_id: null}),
          makeTransaction({sdk_name: 'javascript', parent_span_id: null}),
        ],
        orphan_errors: [],
      }),
      {replay: null, meta: null}
    );

    expect(tree.shape).toBe(TraceShape.BROWSER_MULTIPLE_ROOTS);
  });

  it('multiple roots', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            parent_span_id: null,
            children: [],
          }),
          makeTransaction({
            parent_span_id: null,
            children: [],
          }),
        ],
        orphan_errors: [],
      }),
      {replay: null, meta: null}
    );

    expect(tree.shape).toBe(TraceShape.MULTIPLE_ROOTS);
  });

  it('only errors', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [],
        orphan_errors: [makeTraceError()],
      }),
      {replay: null, meta: null}
    );

    expect(tree.shape).toBe(TraceShape.ONLY_ERRORS);
  });
});
