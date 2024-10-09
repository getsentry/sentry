import {
  makeEventTransaction,
  makeSpan,
  makeTrace,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {isMissingInstrumentationNode} from './../traceGuards';
import {TraceTree} from './traceTree';

const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;
const traceMetadata = {replayRecord: null, meta: null};

const singleTransactionTrace = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: start,
      timestamp: start + 2,
      children: [],
    }),
  ],
  orphan_errors: [],
});

const missingInstrumentationSpans = [
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start + 2,
    timestamp: start + 4,
  }),
];

const childrenMissingInstrumentationSpans = [
  makeSpan({
    op: 'db',
    description: 'redis',
    span_id: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
  makeSpan({
    op: 'http',
    description: 'request',
    span_id: 'other redis',
    parent_span_id: 'redis',
    start_timestamp: start + 2,
    timestamp: start + 4,
  }),
];

describe('missing instrumentation', () => {
  it('adds missing instrumentation between sibling spans', () => {
    const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
    TraceTree.FromSpans(
      tree.root.children[0].children[0],
      missingInstrumentationSpans,
      makeEventTransaction(),
      {
        sdk: undefined,
      }
    );

    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('adds missing instrumentation between children spans', () => {
    const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
    TraceTree.FromSpans(
      tree.root.children[0].children[0],
      childrenMissingInstrumentationSpans,
      makeEventTransaction(),
      {
        sdk: undefined,
      }
    );

    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('adds missing instrumentation between two spans that share a common root', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            span_id: 'parent-transaction',
          }),
        ],
      }),
      traceMetadata
    );

    TraceTree.FromSpans(
      tree.root.children[0].children[0],
      [
        makeSpan({
          op: 'http',
          description: 'request',
          span_id: '0000',
          parent_span_id: 'parent-transaction',
          start_timestamp: start,
          timestamp: start + 2,
        }),
        makeSpan({
          op: 'db',
          description: 'redis',
          span_id: '0001',
          parent_span_id: '0000',
          start_timestamp: start,
          timestamp: start + 2,
        }),
        makeSpan({
          op: 'cache',
          description: 'redis',
          span_id: '0002',
          parent_span_id: 'parent-transaction',
          start_timestamp: start + 3,
          timestamp: start + 4,
        }),
      ],
      makeEventTransaction(),
      {
        sdk: undefined,
      }
    );

    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('does not add missing instrumentation for browser SDKs', () => {
    const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
    TraceTree.FromSpans(
      tree.root.children[0].children[0],
      missingInstrumentationSpans,
      makeEventTransaction(),
      {
        sdk: 'sentry.javascript.browser',
      }
    );

    expect(TraceTree.Find(tree.root, c => isMissingInstrumentationNode(c))).toBeNull();
    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it.each([
    ['children', childrenMissingInstrumentationSpans],
    ['siblings', missingInstrumentationSpans],
  ])('idempotent - %s', (_type, setup) => {
    const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
    TraceTree.FromSpans(
      tree.root.children[0].children[0],
      setup,
      makeEventTransaction(),
      {
        sdk: undefined,
      }
    );

    const initial = tree.build().serialize();
    TraceTree.DetectMissingInstrumentation(tree.root, 100, undefined);
    expect(tree.build().serialize()).toMatchSnapshot();
    expect(tree.build().serialize()).toEqual(initial);
  });
});
