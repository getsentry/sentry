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

import {isMissingInstrumentationNode} from './../traceGuards';
import {TraceTree} from './traceTree';

const organization = OrganizationFixture();

const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;
const traceMetadata = {replay: null, meta: null, organization};

const singleTransactionTrace = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: start,
      timestamp: start + 2,
      children: [],
      event_id: 'event-id',
      project_slug: 'project',
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

const eapMissingInstrumentationSpans = [
  makeEAPSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    end_timestamp: start + 1,
  }),
  makeEAPSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start + 2,
    end_timestamp: start + 4,
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

const eapChildrenMissingInstrumentationSpans = [
  makeEAPSpan({
    op: 'db',
    description: 'redis',
    event_id: 'redis',
    start_timestamp: start,
    end_timestamp: start + 1,
    children: [
      makeEAPSpan({
        op: 'http',
        description: 'request',
        event_id: 'other redis',
        parent_span_id: 'redis',
        start_timestamp: start + 2,
        end_timestamp: start + 4,
      }),
    ],
  }),
];

describe('missing instrumentation', () => {
  it('adds missing instrumentation between sibling spans', async () => {
    const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);

    mockSpansResponse(missingInstrumentationSpans, 'project', 'event-id');
    await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
      api: new MockApiClient(),
      organization,
      preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
    });

    TraceTree.DetectMissingInstrumentation(tree.root);
    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('adds missing instrumentation between children spans', async () => {
    const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);

    mockSpansResponse(childrenMissingInstrumentationSpans, 'project', 'event-id');
    await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
      api: new MockApiClient(),
      organization,
      preferences: {...DEFAULT_TRACE_VIEW_PREFERENCES, missing_instrumentation: true},
    });

    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('adds missing instrumentation between two spans that share a common root', async () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            span_id: 'parent-transaction',
            event_id: 'event-id',
            project_slug: 'project',
          }),
        ],
      }),
      traceMetadata
    );

    mockSpansResponse(
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
      'project',
      'event-id'
    );

    await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
      api: new MockApiClient(),
      organization,
      preferences: {...DEFAULT_TRACE_VIEW_PREFERENCES, missing_instrumentation: false},
    });

    TraceTree.DetectMissingInstrumentation(tree.root);

    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('removes missing instrumentation nodes', async () => {
    const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);

    mockSpansResponse(missingInstrumentationSpans, 'project', 'event-id');
    await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
      api: new MockApiClient(),
      organization,
      preferences: {...DEFAULT_TRACE_VIEW_PREFERENCES, missing_instrumentation: false},
    });

    const snapshot = tree.build().serialize();

    TraceTree.DetectMissingInstrumentation(tree.root);

    // Assert that missing instrumentation nodes exist
    expect(tree.root.findChild(c => isMissingInstrumentationNode(c))).not.toBeNull();

    // Remove it and assert that the tree is back to the original state
    TraceTree.RemoveMissingInstrumentationNodes(tree.root);

    expect(tree.build().serialize()).toEqual(snapshot);
    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('does not add missing instrumentation for browser SDKs', async () => {
    const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);

    mockSpansResponse(missingInstrumentationSpans, 'project', 'event-id');
    await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
      api: new MockApiClient(),
      organization,
      preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
    });

    expect(tree.root.findChild(c => isMissingInstrumentationNode(c))).toBeNull();
    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it.each([
    ['children', childrenMissingInstrumentationSpans],
    ['siblings', missingInstrumentationSpans],
  ])('idempotent - %s', async (_type, setup) => {
    const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);

    mockSpansResponse(setup, 'project', 'event-id');
    await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
      api: new MockApiClient(),
      organization,
      preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
    });

    TraceTree.DetectMissingInstrumentation(tree.root);
    const initial = tree.build().serialize();
    expect(tree.build().serialize()).toMatchSnapshot();
    expect(tree.build().serialize()).toEqual(initial);
  });

  describe('eap traces', () => {
    it('adds missing instrumentation between sibling eap spans', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace(eapMissingInstrumentationSpans),
        traceMetadata
      );

      TraceTree.DetectMissingInstrumentation(tree.root);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('adds missing instrumentation between eap children spans', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace(eapChildrenMissingInstrumentationSpans),
        traceMetadata
      );

      TraceTree.DetectMissingInstrumentation(tree.root);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('removes missing instrumentation nodes', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace(eapMissingInstrumentationSpans),
        traceMetadata
      );

      const snapshot = tree.build().serialize();

      TraceTree.DetectMissingInstrumentation(tree.root);

      // Assert that missing instrumentation nodes exist
      expect(tree.root.findChild(c => isMissingInstrumentationNode(c))).not.toBeNull();

      // Remove it and assert that the tree is back to the original state
      TraceTree.RemoveMissingInstrumentationNodes(tree.root);

      expect(tree.build().serialize()).toEqual(snapshot);
      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });
});
