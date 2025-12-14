import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  makeEAPSpan,
  makeEAPTrace,
  makeSpan,
  makeTrace,
  makeTransaction,
  mockSpansResponse,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';

import {TraceTree} from './traceTree';

const organization = OrganizationFixture();
const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;

const traceMetadata = {replay: null, meta: null, organization};

const ssrTrace = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: start,
      timestamp: start + 2,
      ['transaction.op']: 'http.server',
      event_id: '000',
      project_slug: 'project-0',
      children: [
        makeTransaction({
          start_timestamp: start,
          timestamp: start + 2,
          ['transaction.op']: 'pageload',
          children: [],
          event_id: '001',
          project_slug: 'project-1',
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

  it('reparents server handler under browser request span', async () => {
    const tree = TraceTree.FromTrace(ssrTrace, traceMetadata);

    mockSpansResponse([], 'project-0', '000');
    mockSpansResponse(ssrSpans, 'project-1', '001');
    await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
      api: new MockApiClient(),
      organization,
      preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
    });

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

  it('does not reparent if server handler does not have SSR reparent reason', async () => {
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
    mockSpansResponse(ssrSpans, 'project-1', '001');
    mockSpansResponse([], 'project-0', '000');
    await tree.fetchNodeSubTree(true, pageload, {
      api: new MockApiClient(),
      organization,
      preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
    });

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
      pageload.expand(true, tree);

      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });
});
