import {OrganizationFixture} from 'sentry-fixture/organization';

import {EntryType} from 'sentry/types/event';
import {
  isSpanNode,
  isTraceErrorNode,
  isTraceNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
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

function hasErrors(n: TraceTreeNode<any>): boolean {
  return (
    (isTraceErrorNode(n) || n.errors.size > 0 || n.occurences.size > 0) && !isTraceNode(n)
  );
}

describe('IssuesTraceTree', () => {
  it('collapsed nodes without errors', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithErrorInMiddle, {
      meta: null,
      replay: null,
    });

    const issues = IssuesTraceTree.FindAll(tree.root, hasErrors);
    expect(tree.build().collapseList(issues, 3, 0).serialize()).toMatchSnapshot();
  });

  it('preserves path to child error', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithChildError, {
      meta: null,
      replay: null,
    });

    const error = IssuesTraceTree.Find(tree.root, hasErrors);

    let node = error;
    const nodes: Array<TraceTreeNode<any>> = [];
    while (node && !isTraceNode(node)) {
      nodes.push(node);
      node = node.parent;
    }

    expect(tree.build().collapseList(nodes, 3, 0).serialize()).toMatchSnapshot();
  });

  it('errors only', () => {
    // has +100 issues at the end
    const tree = IssuesTraceTree.FromTrace(errorsOnlyTrace, {
      meta: null,
      replay: null,
    });

    const errors = IssuesTraceTree.FindAll(tree.root, hasErrors).slice(0, 10);
    expect(tree.build().collapseList(errors, 3, 0).serialize()).toMatchSnapshot();
  });

  it('respects numSurroundingNodes parameter', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithErrorInMiddle, {
      meta: null,
      replay: null,
    });

    const issues = IssuesTraceTree.FindAll(tree.root, hasErrors);

    // Test with default value (3)
    const defaultCollapsed = tree.build().collapseList(issues, 3, 0).serialize();

    // Test with custom value (2)
    const customCollapsed = tree.build().collapseList(issues, 2, 0).serialize();

    expect(defaultCollapsed).toMatchSnapshot('default surrounding nodes (3)');
    expect(customCollapsed).toMatchSnapshot('custom surrounding nodes (2)');

    expect(defaultCollapsed).not.toEqual(customCollapsed);
  });

  it('respects minShownNodes parameter', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithErrorInMiddle, {
      meta: null,
      replay: null,
    });

    const issues = IssuesTraceTree.FindAll(tree.root, hasErrors);

    // Test with default minShownNodes value
    const defaultMinShown = tree.build().collapseList(issues, 0, 3).serialize();

    // Test with a smaller minShownNodes value
    const smallerMinShown = tree.build().collapseList(issues, 0, 0).serialize();

    expect(defaultMinShown).toMatchSnapshot('default minShownNodes (3)');
    expect(smallerMinShown).toMatchSnapshot('smaller minShownNodes (0)');
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

      const span = TraceTree.Find(
        tree.root,
        node => isSpanNode(node) && node.value.span_id === 'error-span-id'
      )!;
      expect(tree.build().collapseList([span], 3, 0).serialize()).toMatchSnapshot();
    });
  });
});
