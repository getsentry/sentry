import {
  makeEventTransaction,
  makeSpan,
  makeTrace,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {TraceTree} from './traceTree';

const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;

const traceMetadata = {replay: null, meta: null};

const ssrTrace = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: start,
      timestamp: start + 2,
      ['transaction.op']: 'http.server',
      children: [
        makeTransaction({
          start_timestamp: start,
          timestamp: start + 2,
          ['transaction.op']: 'pageload',
          children: [],
        }),
      ],
    }),
  ],
});

const ssrSpans = [
  makeSpan({
    op: 'tls.connect',
    start_timestamp: start,
    timestamp: start + 2,
  }),
  makeSpan({
    op: 'browser.request',
    description: 'browser',
    start_timestamp: start,
    timestamp: start + 2,
  }),
];

describe('server side rendering', () => {
  it('reparents pageload transaction as parent of server handler', () => {
    const tree = TraceTree.FromTrace(ssrTrace, traceMetadata);

    const pageload = tree.root.children[0]!.children[0]!;
    const serverHandler = pageload.children[0]!;

    expect(serverHandler.parent).toBe(pageload);
    expect(pageload.parent).toBe(tree.root.children[0]);
    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('reparents server handler under browser request span', () => {
    const tree = TraceTree.FromTrace(ssrTrace, traceMetadata);

    TraceTree.FromSpans(
      tree.root.children[0]!.children[0]!,
      ssrSpans,
      makeEventTransaction()
    );
    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('does not reparent if server handler has multiple direct transaction children', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            transaction: 'SSR',
            ['transaction.op']: 'http.server',
            children: [
              makeTransaction({
                transaction: 'pageload',
                ['transaction.op']: 'pageload',
              }),
              makeTransaction({
                transaction: 'pageload',
                ['transaction.op']: 'pageload',
              }),
            ],
          }),
        ],
      }),
      traceMetadata
    );

    expect(tree.build().serialize()).toMatchSnapshot();
  });
});
