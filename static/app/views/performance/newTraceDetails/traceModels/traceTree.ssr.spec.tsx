import {
  makeEAPSpan,
  makeEAPTrace,
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

const ssrEAPTrace = makeEAPTrace([
  makeEAPSpan({
    event_id: '000',
    op: 'http.server',
    start_timestamp: start,
    end_timestamp: start + 2,
    is_transaction: true,
    children: [
      makeEAPSpan({
        event_id: '001',
        op: 'pageload',
        start_timestamp: start,
        is_transaction: true,
        end_timestamp: start + 2,
        parent_span_id: '000',
        children: [
          makeEAPSpan({
            op: 'tls.connect',
            start_timestamp: start,
            end_timestamp: start + 2,
          }),
          makeEAPSpan({
            op: 'browser.request',
            description: 'browser',
            start_timestamp: start,
            end_timestamp: start + 2,
          }),
        ],
      }),
    ],
  }),
]);

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

  it('does not reparent if server handler does not have SSR reparent reason', () => {
    const tree = TraceTree.FromTrace(ssrTrace, traceMetadata);

    // The automatic pageload reparenting should have happened
    const pageload = tree.root.children[0]!.children[0]!;
    const serverHandler = pageload.children[0]!;

    // @ts-expect-error implicit any
    expect(pageload?.value['transaction.op']).toBe('pageload');
    // @ts-expect-error implicit any
    expect(serverHandler?.value['transaction.op']).toBe('http.server');

    expect(serverHandler.parent).toBe(pageload);

    // Usually, an SSR server handler gets a reparent reason, but we want to test that it does not
    // get re-parented again when there is no reparent reason.
    serverHandler.reparent_reason = null;

    // This is where it would re-parent again
    TraceTree.FromSpans(pageload, ssrSpans, makeEventTransaction());

    const browserRequestSpan = tree.root.children[0]!.children[0]!.children.find(
      span => span.value && 'op' in span.value && span.value.op === 'browser.request'
    );

    expect(browserRequestSpan).toBeDefined();
    expect(serverHandler.parent).toBe(pageload);
    expect(browserRequestSpan?.children).not.toContain(serverHandler);
  });

  describe('eap traces', () => {
    it('reparents pageload transaction as parent of server handler', () => {
      const tree = TraceTree.FromTrace(ssrEAPTrace, traceMetadata);

      const pageload = tree.root.children[0]!.children[0]!;
      const serverHandler = pageload.children[0]!;

      expect(serverHandler.parent).toBe(pageload);
      expect(pageload.parent).toBe(tree.root.children[0]);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('reparents server handler under browser request span', () => {
      const tree = TraceTree.FromTrace(ssrEAPTrace, traceMetadata);

      const pageload = tree.root.children[0]!.children[0]!;
      tree.expand(pageload, true);

      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });
});
