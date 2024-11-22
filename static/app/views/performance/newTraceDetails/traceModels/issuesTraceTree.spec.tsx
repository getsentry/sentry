import {OrganizationFixture} from 'sentry-fixture/organization';

import {EntryType} from 'sentry/types/event';
import {isTransactionNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';

import {IssuesTraceTree} from './issuesTraceTree';
import {
  makeEventTransaction,
  makeSpan,
  makeTrace,
  makeTraceError,
  makeTransaction,
} from './traceTreeTestUtils';

const traceWithErrorInMiddle = makeTrace({
  transactions: [
    makeTransaction({transaction: 'transaction 1'}),
    makeTransaction({transaction: 'transaction 2'}),
    makeTransaction({transaction: 'transaction 3', errors: [makeTraceError({})]}),
    makeTransaction({transaction: 'transaction 4'}),
    makeTransaction({transaction: 'transaction 5'}),
  ],
});

const traceWithChildError = makeTrace({
  transactions: [
    makeTransaction({transaction: 'transaction 1'}),
    makeTransaction({
      transaction: 'transaction 2',
      children: [makeTransaction({errors: [makeTraceError({})]})],
    }),
    makeTransaction({transaction: 'transaction 4'}),
  ],
});

const errorsOnlyTrace = makeTrace({
  transactions: [],
  orphan_errors: new Array(20).fill(null).map(() => makeTraceError({})),
});

const traceWithSiblingCollapsedNodes = makeTrace({
  transactions: [
    makeTransaction({
      transaction: 'transaction 1',
      children: [
        makeTransaction({}),
        makeTransaction({}),
        makeTransaction({
          transaction: 'transaction 2',
          errors: [makeTraceError({})],
        }),
        makeTransaction({}),
      ],
    }),
    makeTransaction({transaction: 'transaction 3'}),
    makeTransaction({transaction: 'transaction 4'}),
  ],
});

function mockSpansResponse(
  spans: TraceTree.Span[],
  project_slug: string,
  event_id: string
): jest.Mock<any, any> {
  return MockApiClient.addMockResponse({
    url: `/organizations/org-slug/events/${project_slug}:${event_id}/?averageColumn=span.self_time&averageColumn=span.duration`,
    method: 'GET',
    body: makeEventTransaction({
      entries: [{type: EntryType.SPANS, data: spans}],
    }),
  });
}

describe('IssuesTraceTree', () => {
  it('collapsed nodes without errors', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithErrorInMiddle, {
      meta: null,
      replay: null,
    });

    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('preserves path to child error', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithChildError, {
      meta: null,
      replay: null,
    });

    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('errors only', () => {
    // has +100 issues at the end
    const tree = IssuesTraceTree.FromTrace(errorsOnlyTrace, {
      meta: null,
      replay: null,
    });

    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('collapses sibling collapsed nodes', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithSiblingCollapsedNodes, {
      meta: null,
      replay: null,
    });

    expect(tree.build().serialize()).toMatchSnapshot();
  });

  describe('FromSpans', () => {
    const traceWithSpans = makeTrace({
      transactions: [
        makeTransaction({transaction: 'transaction 0'}),
        makeTransaction({transaction: 'transaction 0'}),
        makeTransaction({
          transaction: 'transaction 1',
          children: [
            makeTransaction({
              transaction: 'transaction 2',
              event_id: 'event-id',
              project_slug: 'project',
              errors: [
                makeTraceError({
                  span: 'error-span-id',
                }),
              ],
            }),
          ],
        }),
      ],
    });

    it('collapses spans', async () => {
      const tree = IssuesTraceTree.FromTrace(traceWithSpans, {
        meta: null,
        replay: null,
      });

      mockSpansResponse(
        [
          makeSpan({op: 'cache', description: 'GET'}),
          makeSpan({op: 'http', description: 'GET /'}),
          makeSpan({op: 'db', description: 'SELECT'}),
          makeSpan({op: 'cache', description: 'GET'}),
          makeSpan({op: 'http', description: 'GET /', span_id: 'error-span-id'}),
          makeSpan({op: 'db', description: 'SELECT'}),
        ],
        'project',
        'event-id'
      );

      const txn = TraceTree.Find(
        tree.root,
        node => isTransactionNode(node) && node.value.transaction === 'transaction 2'
      )!;

      await tree.zoom(txn, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });
});
