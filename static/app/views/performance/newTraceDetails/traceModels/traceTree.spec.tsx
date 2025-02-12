import {OrganizationFixture} from 'sentry-fixture/organization';

import {EntryType} from 'sentry/types/event';
import type {SiblingAutogroupNode} from 'sentry/views/performance/newTraceDetails/traceModels/siblingAutogroupNode';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import type {ReplayRecord} from 'sentry/views/replays/types';

import {
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
  isSpanNode,
  isTransactionNode,
} from './../traceGuards';
import type {ParentAutogroupNode} from './parentAutogroupNode';
import {TraceTree} from './traceTree';
import {
  assertTransactionNode,
  makeEventTransaction,
  makeSpan,
  makeTrace,
  makeTraceError,
  makeTracePerformanceIssue,
  makeTransaction,
} from './traceTreeTestUtils';

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

const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;
const end = new Date('2024-02-29T00:00:00Z').getTime() / 1e3 + 5;

const traceMetadata = {replay: null, meta: null};

const trace = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: start,
      timestamp: start + 2,
      children: [makeTransaction({start_timestamp: start + 1, timestamp: start + 4})],
    }),
  ],
  orphan_errors: [],
});

const traceWithEventId = makeTrace({
  transactions: [
    makeTransaction({
      event_id: 'event-id',
      start_timestamp: start,
      timestamp: start + 2,
      project_slug: 'project',
      children: [
        makeTransaction({
          start_timestamp: start + 1,
          timestamp: start + 4,
          event_id: 'child-event-id',
          project_slug: 'project',
        }),
      ],
    }),
  ],
});

const traceWithVitals = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: start,
      timestamp: start + 2,
      measurements: {ttfb: {value: 0, unit: 'millisecond'}},
    }),
  ],
});

const traceWithOrphanError = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: start,
      timestamp: start + 2,
      children: [makeTransaction({start_timestamp: start + 1, timestamp: start + 2})],
    }),
  ],
  orphan_errors: [makeTraceError({level: 'error', timestamp: end})],
});

const outOfOrderTrace = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: 1,
      transaction: 'last',
      children: [],
    }),
    makeTransaction({start_timestamp: 0, transaction: 'first'}),
  ],
});

const siblingAutogroupSpans = [
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
];

const parentAutogroupSpans = [
  makeSpan({op: 'db', description: 'redis', span_id: '0000'}),
  makeSpan({op: 'db', description: 'redis', span_id: '0001', parent_span_id: '0000'}),
];

const parentAutogroupSpansWithTailChildren = [
  makeSpan({op: 'db', description: 'redis', span_id: '0000'}),
  makeSpan({
    op: 'db',
    description: 'redis',
    span_id: '0001',
    parent_span_id: '0000',
  }),
  makeSpan({
    op: 'http',
    description: 'request',
    span_id: '0002',
    parent_span_id: '0001',
  }),
];

function findTransactionByEventId(tree: TraceTree, eventId: string) {
  return TraceTree.Find(
    tree.root,
    node => isTransactionNode(node) && node.value.event_id === eventId
  );
}

describe('TraceTree', () => {
  describe('aggreagate node properties', () => {
    it('adds errors to node', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              errors: [makeTraceError()],
            }),
          ],
        }),
        traceMetadata
      );
      expect(tree.root.children[0]!.errors.size).toBe(1);
    });

    it('stores trace error as error on node', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          orphan_errors: [makeTraceError()],
        }),
        traceMetadata
      );
      expect(tree.root.children[0]!.children[0]!.errors.size).toBe(1);
    });

    it('adds performance issues to node', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              performance_issues: [makeTracePerformanceIssue()],
            }),
          ],
        }),
        traceMetadata
      );
      expect(tree.root.children[0]!.children[0]!.performance_issues.size).toBe(1);
    });

    it('adds transaction profile to node', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              profile_id: 'profile-id',
            }),
          ],
        }),
        traceMetadata
      );
      expect(tree.root.children[0]!.children[0]!.profiles).toHaveLength(1);
    });

    it('adds continuous profile to node', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              profiler_id: 'profile-id',
              children: [],
            }),
          ],
        }),
        traceMetadata
      );
      expect(tree.root.children[0]!.children[0]!.profiles).toHaveLength(1);
    });
  });

  describe('adjusts trace start and end', () => {
    it('based off min(events.start_timestamp)', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      expect(tree.root.space[0]).toBe(trace.transactions[0]!.start_timestamp * 1e3);
    });

    it('based off max(events.timestamp)', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      expect(tree.root.space[1]).toBe(4000);
    });

    // This happnes for errors only traces
    it('end,0 when we cannot construct a timeline', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({orphan_errors: [makeTraceError({level: 'error', timestamp: end})]}),
        traceMetadata
      );

      expect(tree.root.space[0]).toBe(end * 1e3);
      expect(tree.root.space[1]).toBe(0);
    });

    it('considers all children when inferring start and end', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: start,
              timestamp: start + 1,
              children: [],
            }),
            makeTransaction({
              start_timestamp: start - 1,
              timestamp: start + 2,
              children: [],
            }),
          ],
          orphan_errors: [],
        }),
        traceMetadata
      );
      expect(tree.root.space[1]).toBe(3000);
      expect(tree.root.space[0]).toBe(start * 1e3 - 1e3);
    });

    it('considers orphan errors when inferring end', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: start,
              timestamp: start + 1,
              children: [],
            }),
          ],
          orphan_errors: [
            makeTraceError({
              level: 'error',
              timestamp: start + 5,
            }),
          ],
        }),
        traceMetadata
      );
      expect(tree.root.space[1]).toBe(5000);
      expect(tree.root.space[0]).toBe(start * 1e3);
    });

    it('replay record extends trace start', () => {
      const replayStart = new Date('2024-02-29T00:00:00Z').getTime();
      const replayEnd = new Date(replayStart + 5000).getTime();

      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: replayStart / 1e3 + 0.1,
              timestamp: replayStart / 1e3 + 0.1,
            }),
          ],
        }),
        {
          meta: null,
          replay: {
            started_at: new Date(replayStart),
            finished_at: new Date(replayEnd),
          } as ReplayRecord,
        }
      );

      expect(tree.root.space[0]).toBe(replayStart);
      expect(tree.root.space[1]).toBe(5000);
    });

    it('measurements extend trace start and end', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: start,
              timestamp: start + 1,
              children: [],
              measurements: {
                ttfb: {
                  unit: 'millisecond',
                  value: -5000,
                },
                lcp: {
                  unit: 'millisecond',
                  value: 5000,
                },
              },
            }),
          ],
          orphan_errors: [],
        }),
        traceMetadata
      );
      expect(tree.root.space).toEqual([start * 1e3 - 5000, 10_000]);
    });
  });

  describe('indicators', () => {
    it('measurements are converted to indicators', () => {
      const tree = TraceTree.FromTrace(traceWithVitals, traceMetadata);
      expect(tree.indicators).toHaveLength(1);
      expect(tree.indicators[0]!.start).toBe(start * 1e3);
    });

    it('sorts indicators by start', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: 0,
              timestamp: 1,
              measurements: {
                ttfb: {value: 2000, unit: 'millisecond'},
                lcp: {value: 1000, unit: 'millisecond'},
              },
            }),
          ],
        }),
        traceMetadata
      );
      expect(tree.indicators).toHaveLength(2);
      expect(tree.indicators[0]!.start < tree.indicators[1]!.start).toBe(true);
    });
  });

  describe('FromTrace', () => {
    it('assembles tree from trace', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('sorts by start_timestamp', () => {
      const tree = TraceTree.FromTrace(outOfOrderTrace, traceMetadata);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('inserts orphan error', () => {
      const tree = TraceTree.FromTrace(traceWithOrphanError, {
        meta: null,
        replay: null,
      });
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('if parent span does not exist in span tree, the transaction stays under its previous parent', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'root',
              children: [
                makeTransaction({transaction: 'child', parent_span_id: 'does not exist'}),
              ],
            }),
          ],
        }),
        traceMetadata
      );

      TraceTree.FromSpans(tree.root.children[0]!, [makeSpan()], makeEventTransaction());

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('initializes canFetch based on spanChildrenCount', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              event_id: 'transaction',
              children: [],
            }),
            makeTransaction({event_id: 'no-span-count-transaction'}),
            makeTransaction({event_id: 'no-spans-transaction', children: []}),
          ],
        }),
        {
          meta: {
            transactiontoSpanChildrenCount: {
              transaction: 10,
              'no-spans-transaction': 1,
              // we have no data for child transaction
            },
            errors: 0,
            performance_issues: 0,
            projects: 0,
            transactions: 0,
          },
          replay: null,
        }
      );

      expect(findTransactionByEventId(tree, 'transaction')?.canFetch).toBe(true);
      expect(findTransactionByEventId(tree, 'no-span-count-transaction')?.canFetch).toBe(
        true
      );
      expect(findTransactionByEventId(tree, 'no-spans-transaction')?.canFetch).toBe(
        false
      );
    });

    it('initializes canFetch to true if no spanChildrenCount', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              event_id: 'transaction',
              children: [],
            }),
          ],
        }),
        {meta: null, replay: null}
      );

      expect(findTransactionByEventId(tree, 'transaction')?.canFetch).toBe(true);
    });
  });

  describe('events', () => {
    it('does not dispatch timeline change when spans fall inside the trace bounds', async () => {
      const t = makeTrace({
        transactions: [
          makeTransaction({
            start_timestamp: start,
            timestamp: start + 2,
            event_id: 'event-id',
            project_slug: 'project',
            children: [],
          }),
        ],
        orphan_errors: [],
      });

      const tree = TraceTree.FromTrace(t, traceMetadata);

      const listener = jest.fn();
      tree.on('trace timeline change', listener);

      const txn = TraceTree.Find(tree.root, n => isTransactionNode(n))!;

      mockSpansResponse(
        [makeSpan({start_timestamp: start + 0.5, timestamp: start + 1})],
        'project',
        'event-id'
      );

      await tree.zoom(txn, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(listener).not.toHaveBeenCalled();
    });

    it('dispatches timeline change when span timestamp > trace timestamp', async () => {
      const t = makeTrace({
        transactions: [
          makeTransaction({
            start_timestamp: start,
            timestamp: start + 1,
            event_id: 'event-id',
            project_slug: 'project',
            children: [],
          }),
        ],
        orphan_errors: [],
      });
      const tree = TraceTree.FromTrace(t, traceMetadata);

      const listener = jest.fn();
      tree.on('trace timeline change', listener);

      const txn = TraceTree.Find(tree.root, n => isTransactionNode(n))!;

      const transactionSpaceBounds = JSON.stringify(txn.space);

      mockSpansResponse(
        [makeSpan({start_timestamp: start, timestamp: start + 1.2})],
        'project',
        'event-id'
      );

      await tree.zoom(txn, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(JSON.stringify(txn.space)).toEqual(transactionSpaceBounds);
      expect(listener).toHaveBeenCalledWith([start * 1e3, 1200]);
    });
  });

  describe('ForEachChild', () => {
    it('iterates dfs', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'root',
              children: [
                makeTransaction({transaction: 'child'}),
                makeTransaction({transaction: 'other_child'}),
              ],
            }),
          ],
        }),
        {meta: null, replay: null}
      );

      const visitedNodes: string[] = [];
      TraceTree.ForEachChild(tree.root, node => {
        if (isTransactionNode(node)) {
          visitedNodes.push(node.value.transaction);
        }
      });

      expect(visitedNodes).toEqual(['root', 'child', 'other_child']);
    });
  });

  describe('expand', () => {
    it('expanding a parent autogroup node shows head to tail chain', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);

      TraceTree.FromSpans(
        tree.root.children[0]!.children[0]!,
        parentAutogroupSpansWithTailChildren,
        makeEventTransaction()
      );

      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

      const parentAutogroupNode = TraceTree.Find(tree.root, n =>
        isParentAutogroupedNode(n)
      )!;

      tree.expand(parentAutogroupNode, true);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('collapsing a parent autogroup node shows tail chain', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0]!.children[0]!,
        parentAutogroupSpansWithTailChildren,
        makeEventTransaction()
      );

      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

      const parentAutogroupNode = TraceTree.Find(tree.root, n =>
        isParentAutogroupedNode(n)
      )!;
      tree.expand(parentAutogroupNode, true);
      tree.expand(parentAutogroupNode, false);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('collapsing intermediary children is preserved', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0]!.children[0]!,
        parentAutogroupSpansWithTailChildren,
        makeEventTransaction()
      );

      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

      const parentAutogroupNode = TraceTree.Find(tree.root, n =>
        isParentAutogroupedNode(n)
      )! as ParentAutogroupNode;

      // Expand the chain and collapse an intermediary child
      tree.expand(parentAutogroupNode, true);
      tree.expand(parentAutogroupNode.head, false);

      const snapshot = tree.build().serialize();

      // Collapse the autogroup node and expand it again
      tree.expand(parentAutogroupNode, false);
      tree.expand(parentAutogroupNode, true);

      // Assert that the snapshot is preserved and we only render the parent autogroup chain
      // up to the collapsed span
      expect(tree.build().serialize()).toEqual(snapshot);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('expanding a sibling autogroup node shows sibling span', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0]!.children[0]!,
        siblingAutogroupSpans,
        makeEventTransaction()
      );

      TraceTree.AutogroupSiblingSpanNodes(tree.root);
      TraceTree.ForEachChild(tree.root, n => {
        if (isSiblingAutogroupedNode(n)) {
          tree.expand(n, true);
        }
      });
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('collapsing a sibling autogroup node hides children', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0]!.children[0]!,
        siblingAutogroupSpans,
        makeEventTransaction()
      );

      TraceTree.AutogroupSiblingSpanNodes(tree.root);
      TraceTree.ForEachChild(tree.root, n => {
        if (isSiblingAutogroupedNode(n)) {
          tree.expand(n, true);
        }
      });

      TraceTree.ForEachChild(tree.root, n => {
        if (isSiblingAutogroupedNode(n)) {
          tree.expand(n, false);
        }
      });
      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });

  describe('zoom', () => {
    it('does nothing if node cannot fetch', () => {
      const tree = TraceTree.FromTrace(traceWithEventId, traceMetadata);
      const request = mockSpansResponse([], 'project', 'event-id');

      tree.root.children[0]!.children[0]!.canFetch = false;
      tree.zoom(tree.root.children[0]!.children[0]!, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(request).not.toHaveBeenCalled();
    });

    it('caches promise', () => {
      const tree = TraceTree.FromTrace(traceWithEventId, traceMetadata);
      const request = mockSpansResponse([], 'project', 'event-id');

      tree.zoom(tree.root.children[0]!.children[0]!, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      tree.zoom(tree.root.children[0]!, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('zooms in on transaction node', async () => {
      const tree = TraceTree.FromTrace(traceWithEventId, traceMetadata);

      mockSpansResponse([makeSpan()], 'project', 'child-event-id');

      // Zoom mutates the list, so we need to build first
      tree.build();

      await tree.zoom(tree.root.children[0]!.children[0]!.children[0]!, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('maintains the span tree when parent is zoomed in', async () => {
      const tree = TraceTree.FromTrace(traceWithEventId, traceMetadata);
      // Zoom mutates the list, so we need to build first
      tree.build();
      // Zoom in on child span
      mockSpansResponse([makeSpan()], 'project', 'child-event-id');
      await tree.zoom(tree.root.children[0]!.children[0]!.children[0]!, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      // Then zoom in on a parent
      mockSpansResponse([makeSpan()], 'project', 'event-id');
      await tree.zoom(tree.root.children[0]!.children[0]!, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('reparents child transactions under spans with matching ids', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'root',
              event_id: 'parent-event-id',
              project_slug: 'project',
              children: [
                makeTransaction({
                  transaction: 'child',
                  parent_span_id: '0000',
                  event_id: 'child-event-id',
                  project_slug: 'project',
                }),
              ],
            }),
          ],
        }),
        traceMetadata
      );

      // Zoom mutates the list, so we need to build first
      tree.build();

      mockSpansResponse([makeSpan({span_id: '0001'})], 'project', 'child-event-id');
      await tree.zoom(tree.root.children[0]!.children[0]!.children[0]!, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      mockSpansResponse([makeSpan({span_id: '0000'})], 'project', 'parent-event-id');
      await tree.zoom(tree.root.children[0]!.children[0]!, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('preserves parent of nested child transactions', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'root',
              event_id: 'parent-event-id',
              project_slug: 'project',
              children: [
                makeTransaction({
                  transaction: 'child',
                  event_id: 'child-event-id',
                  project_slug: 'project',
                  parent_span_id: '0000',
                  children: [
                    makeTransaction({
                      transaction: 'grandchild',
                      event_id: 'grandchild-event-id',
                      project_slug: 'project',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        traceMetadata
      );

      // Zoom mutates the list, so we need to build first
      tree.build();

      mockSpansResponse([makeSpan({span_id: '0000'})], 'project', 'parent-event-id');
      await tree.zoom(tree.root.children[0]!.children[0]!, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const grandchild = findTransactionByEventId(tree, 'grandchild-event-id');
      const child = findTransactionByEventId(tree, 'child-event-id');

      expect(grandchild?.parent).toBe(child);
      expect(tree.serialize()).toMatchSnapshot();
    });

    it('zoomout returns tree back to a transaction tree', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'root',
              event_id: 'parent-event-id',
              project_slug: 'project',
              children: [
                makeTransaction({
                  transaction: 'child',
                  event_id: 'child-event-id',
                  project_slug: 'project',
                  parent_span_id: '0000',
                  children: [
                    makeTransaction({
                      transaction: 'grandchild',
                      event_id: 'grandchild-event-id',
                      project_slug: 'project',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        traceMetadata
      );

      // Zoom mutates the list, so we need to build first
      const transactionTreeSnapshot = tree.build().serialize();

      mockSpansResponse([makeSpan({span_id: '0000'})], 'project', 'parent-event-id');
      for (const bool of [true, false]) {
        await tree.zoom(tree.root.children[0]!.children[0]!, bool, {
          api: new MockApiClient(),
          organization: OrganizationFixture(),
          preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
        });
      }

      expect(tree.serialize()).toEqual(transactionTreeSnapshot);
    });

    // @TODO This currently filters out all spans - we should preserve spans that are children of other
    // zoomed in transactions
    it('zooming out preserves spans of child zoomed in transaction', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'root',
              event_id: 'parent-event-id',
              project_slug: 'project',
              children: [
                makeTransaction({
                  transaction: 'child',
                  event_id: 'child-event-id',
                  project_slug: 'project',
                  children: [
                    makeTransaction({
                      transaction: 'grandchild',
                      event_id: 'grandchild-event-id',
                      project_slug: 'project',
                      parent_span_id: '0000',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        traceMetadata
      );

      // Zoom mutates the list, so we need to build first
      tree.build();

      mockSpansResponse(
        [makeSpan({span_id: '0000', op: 'parent-op'})],
        'project',
        'child-event-id'
      );

      const child = findTransactionByEventId(tree, 'child-event-id');
      await tree.zoom(child!, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      mockSpansResponse(
        [makeSpan({span_id: '0001', op: 'child-op'})],
        'project',
        'grandchild-event-id'
      );

      const grandchild = findTransactionByEventId(tree, 'grandchild-event-id');
      await tree.zoom(grandchild!, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      await tree.zoom(child!, false, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const spans = TraceTree.FindAll(tree.root, n => isSpanNode(n));
      expect(spans).toHaveLength(1);
      expect(tree.serialize()).toMatchSnapshot();
    });
  });

  describe('Find', () => {
    it('finds first node by predicate', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'first',
              children: [makeTransaction({transaction: 'second'})],
            }),
          ],
        }),
        traceMetadata
      );

      const node = TraceTree.Find(tree.root, n => isTransactionNode(n));
      expect(node).not.toBeNull();
      expect((node as any).value.transaction).toBe('first');
    });
    it('returns null if no node is found', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      const node = TraceTree.Find(tree.root, n => (n as any) === 'does not exist');
      expect(node).toBeNull();
    });
  });

  describe('FindByID', () => {
    it('finds transaction by event_id', () => {
      const traceWithError = makeTrace({
        transactions: [
          makeTransaction({transaction: 'first', event_id: 'first-event-id'}),
        ],
      });
      const tree = TraceTree.FromTrace(traceWithError, traceMetadata);
      const node = TraceTree.FindByID(tree.root, 'first-event-id');

      assertTransactionNode(node);
      expect(node.value.transaction).toBe('first');
    });

    it('matches by error event_id', () => {
      const traceWithError = makeTrace({
        transactions: [
          makeTransaction({
            transaction: 'first',
            event_id: 'txn-event-id',
            errors: [makeTraceError({event_id: 'error-event-id'})],
          }),
        ],
      });
      const tree = TraceTree.FromTrace(traceWithError, traceMetadata);
      const node = TraceTree.FindByID(tree.root, 'error-event-id');

      assertTransactionNode(node);
      expect(node.value.transaction).toBe('first');
    });
  });

  describe('FindAll', () => {
    it('finds all nodes by predicate', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      const nodes = TraceTree.FindAll(tree.root, n => isTransactionNode(n));
      expect(nodes).toHaveLength(2);
    });
  });

  describe('DirectVisibleChildren', () => {
    it('returns children for transaction', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      expect(TraceTree.DirectVisibleChildren(tree.root.children[0]!)).toEqual(
        tree.root.children[0]!.children
      );
    });

    it('returns tail for collapsed parent autogroup', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);

      TraceTree.FromSpans(
        tree.root.children[0]!,
        parentAutogroupSpansWithTailChildren,
        makeEventTransaction()
      );

      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

      const parentAutogroup = TraceTree.Find(tree.root, node =>
        isParentAutogroupedNode(node)
      ) as ParentAutogroupNode;

      expect(parentAutogroup).not.toBeNull();
      expect(TraceTree.DirectVisibleChildren(parentAutogroup)[0]).toBe(
        parentAutogroup.tail.children[0]
      );
    });
    it('returns head for expanded parent autogroup', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);

      TraceTree.FromSpans(
        tree.root.children[0]!,
        parentAutogroupSpans,
        makeEventTransaction()
      );

      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

      const parentAutogroup = TraceTree.Find(tree.root, node =>
        isParentAutogroupedNode(node)
      ) as ParentAutogroupNode;

      tree.expand(parentAutogroup, true);

      expect(TraceTree.DirectVisibleChildren(parentAutogroup)[0]).toBe(
        parentAutogroup.head
      );
    });
  });

  describe('HasVisibleChildren', () => {
    it('true when transaction has children', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [makeTransaction({children: [makeTransaction()]})],
        }),
        traceMetadata
      );
      expect(TraceTree.HasVisibleChildren(tree.root.children[0]!)).toBe(true);
    });

    describe('span', () => {
      it.each([true, false])('%s when span has children and is expanded', expanded => {
        const tree = TraceTree.FromTrace(
          makeTrace({
            transactions: [makeTransaction({children: [makeTransaction()]})],
          }),
          traceMetadata
        );
        TraceTree.FromSpans(
          tree.root.children[0]!,
          [
            makeSpan({span_id: '0000'}),
            makeSpan({span_id: '0001', parent_span_id: '0000'}),
          ],
          makeEventTransaction()
        );

        const span = TraceTree.Find(
          tree.root,
          node => isSpanNode(node) && node.value.span_id === '0000'
        )!;

        tree.expand(span, expanded);
        expect(TraceTree.HasVisibleChildren(span)).toBe(expanded);
      });
    });

    describe('sibling autogroup', () => {
      it.each([true, false])('%s when sibling autogroup is expanded', expanded => {
        const tree = TraceTree.FromTrace(trace, traceMetadata);

        TraceTree.FromSpans(
          tree.root.children[0]!,
          siblingAutogroupSpans,
          makeEventTransaction()
        );

        TraceTree.AutogroupSiblingSpanNodes(tree.root);
        const siblingAutogroup = TraceTree.Find(tree.root, node =>
          isSiblingAutogroupedNode(node)
        );

        tree.expand(siblingAutogroup!, expanded);
        expect(TraceTree.HasVisibleChildren(siblingAutogroup!)).toBe(expanded);
      });
    });

    describe('parent autogroup', () => {
      it.each([true, false])('%s when parent autogroup is expanded', expanded => {
        const tree = TraceTree.FromTrace(trace, traceMetadata);

        TraceTree.FromSpans(
          tree.root.children[0]!,
          parentAutogroupSpans,
          makeEventTransaction()
        );

        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
        const parentAutogroup = TraceTree.Find(tree.root, node =>
          isParentAutogroupedNode(node)
        );

        tree.expand(parentAutogroup!, expanded);
        expect(TraceTree.HasVisibleChildren(parentAutogroup!)).toBe(expanded);
      });
    });

    describe('parent autogroup when tail has children', () => {
      // Always true because tail has children
      it.each([true, false])('%s when parent autogroup is expanded', expanded => {
        const tree = TraceTree.FromTrace(trace, traceMetadata);

        TraceTree.FromSpans(
          tree.root.children[0]!,
          parentAutogroupSpansWithTailChildren,
          makeEventTransaction()
        );

        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
        tree.build();

        const parentAutogroup = TraceTree.Find(tree.root, node =>
          isParentAutogroupedNode(node)
        );

        tree.expand(parentAutogroup!, expanded);
        expect(TraceTree.HasVisibleChildren(parentAutogroup!)).toBe(true);
      });
    });
  });

  describe('IsLastChild', () => {
    it('returns false if node is not last child', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [makeTransaction(), makeTransaction()],
        }),
        traceMetadata
      );
      expect(TraceTree.IsLastChild(tree.root.children[0]!.children[0]!)).toBe(false);
    });
    it('returns true if node is last child', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [makeTransaction(), makeTransaction()],
        }),
        traceMetadata
      );
      expect(TraceTree.IsLastChild(tree.root.children[0]!.children[1]!)).toBe(true);
    });
  });

  describe('Invalidate', () => {
    it('invalidates node', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      tree.root.children[0]!.depth = 10;
      tree.root.children[0]!.connectors = [1, 2, 3];

      TraceTree.invalidate(tree.root.children[0]!, false);
      expect(tree.root.children[0]!.depth).toBeUndefined();
      expect(tree.root.children[0]!.connectors).toBeUndefined();
    });
    it('recursively invalidates children', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      tree.root.children[0]!.depth = 10;
      tree.root.children[0]!.connectors = [1, 2, 3];
      TraceTree.invalidate(tree.root, true);
      expect(tree.root.children[0]!.depth).toBeUndefined();
      expect(tree.root.children[0]!.connectors).toBeUndefined();
    });
  });

  describe('appendTree', () => {
    it('appends tree to end of current tree', () => {
      const tree = TraceTree.FromTrace(trace, {replay: null, meta: null});
      tree.appendTree(TraceTree.FromTrace(trace, {replay: null, meta: null}));
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('appending extends trace space', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [makeTransaction({start_timestamp: start, timestamp: start + 1})],
        }),
        {replay: null, meta: null}
      );

      const otherTree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({start_timestamp: start, timestamp: start + 10}),
          ],
        }),
        {replay: null, meta: null}
      );

      tree.appendTree(otherTree);
      expect(tree.root.space[0]).toBe(start * 1e3);
      expect(tree.root.space[1]).toBe(10 * 1e3);
    });
  });

  describe('PathToNode', () => {
    const nestedTransactionTrace = makeTrace({
      transactions: [
        makeTransaction({
          start_timestamp: start,
          timestamp: start + 2,
          transaction: 'parent',
          span_id: 'parent-span-id',
          event_id: 'parent-event-id',
          children: [
            makeTransaction({
              start_timestamp: start + 1,
              timestamp: start + 4,
              transaction: 'child',
              event_id: 'child-event-id',
            }),
          ],
        }),
      ],
    });

    it('path to transaction node', () => {
      const tree = TraceTree.FromTrace(nestedTransactionTrace, traceMetadata);
      const transactionNode = TraceTree.Find(
        tree.root,
        node => isTransactionNode(node) && node.value.transaction === 'child'
      )!;

      const path = TraceTree.PathToNode(transactionNode);
      expect(path).toEqual(['txn-child-event-id']);
    });

    it('path to span includes parent txn', () => {
      const tree = TraceTree.FromTrace(nestedTransactionTrace, traceMetadata);
      const child = TraceTree.Find(
        tree.root,
        node => isTransactionNode(node) && node.value.transaction === 'child'
      )!;

      TraceTree.FromSpans(
        child,
        [makeSpan({span_id: 'span-id'})],
        makeEventTransaction()
      );

      const span = TraceTree.Find(tree.root, node => isSpanNode(node))!;
      const path = TraceTree.PathToNode(span);
      expect(path).toEqual(['span-span-id', 'txn-child-event-id']);
    });

    describe('parent autogroup', () => {
      const pathParentAutogroupSpans = [
        makeSpan({op: 'db', description: 'redis', span_id: 'head-span-id'}),
        makeSpan({
          op: 'db',
          description: 'redis',
          span_id: 'tail-span-id',
          parent_span_id: 'head-span-id',
        }),
        makeSpan({
          op: 'http',
          description: 'request',
          span_id: 'child-span-id',
          parent_span_id: 'tail-span-id',
        }),
      ];
      it('parent autogroup', () => {
        const tree = TraceTree.FromTrace(nestedTransactionTrace, traceMetadata);
        const child = TraceTree.Find(
          tree.root,
          node => isTransactionNode(node) && node.value.transaction === 'child'
        )!;
        TraceTree.FromSpans(child, pathParentAutogroupSpans, makeEventTransaction());
        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

        const parentAutogroup = TraceTree.Find(tree.root, node =>
          isParentAutogroupedNode(node)
        )!;

        const path = TraceTree.PathToNode(parentAutogroup);
        expect(path).toEqual(['ag-head-span-id', 'txn-child-event-id']);
      });
      it('path to child of parent autogroup skips autogroup', () => {
        const tree = TraceTree.FromTrace(nestedTransactionTrace, traceMetadata);
        const child = TraceTree.Find(
          tree.root,
          node => isTransactionNode(node) && node.value.transaction === 'child'
        )!;
        TraceTree.FromSpans(child, pathParentAutogroupSpans, makeEventTransaction());
        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

        const parentAutogroup = TraceTree.Find(tree.root, node =>
          isParentAutogroupedNode(node)
        ) as ParentAutogroupNode;
        expect(TraceTree.PathToNode(parentAutogroup.tail)).toEqual([
          'span-tail-span-id',
          'txn-child-event-id',
        ]);

        const requestSpan = TraceTree.Find(
          tree.root,
          node => isSpanNode(node) && node.value.description === 'request'
        )!;
        expect(TraceTree.PathToNode(requestSpan)).toEqual([
          'span-child-span-id',
          'txn-child-event-id',
        ]);
      });
    });

    describe('sibling autogroup', () => {
      const pathSiblingAutogroupSpans = [
        makeSpan({
          op: 'db',
          description: 'redis',
          span_id: '0',
          start_timestamp: start,
          timestamp: start + 1,
        }),
        makeSpan({
          op: 'db',
          description: 'redis',
          start_timestamp: start,
          timestamp: start + 1,
          span_id: '1',
        }),
        makeSpan({
          op: 'db',
          description: 'redis',
          start_timestamp: start,
          timestamp: start + 1,
        }),
        makeSpan({
          op: 'db',
          description: 'redis',
          start_timestamp: start,
          timestamp: start + 1,
        }),
        makeSpan({
          op: 'db',
          description: 'redis',
          start_timestamp: start,
          timestamp: start + 1,
        }),
      ];
      it('path to sibling autogroup', () => {
        const tree = TraceTree.FromTrace(nestedTransactionTrace, traceMetadata);
        const child = TraceTree.Find(
          tree.root,
          node => isTransactionNode(node) && node.value.transaction === 'child'
        )!;
        TraceTree.FromSpans(child, pathSiblingAutogroupSpans, makeEventTransaction());
        TraceTree.AutogroupSiblingSpanNodes(tree.root);

        const siblingAutogroup = TraceTree.Find(tree.root, node =>
          isSiblingAutogroupedNode(node)
        ) as SiblingAutogroupNode;

        const path = TraceTree.PathToNode(siblingAutogroup);
        expect(path).toEqual(['ag-0', 'txn-child-event-id']);
      });

      it('path to child of sibling autogroup skips autogroup', () => {
        const tree = TraceTree.FromTrace(nestedTransactionTrace, traceMetadata);
        const child = TraceTree.Find(
          tree.root,
          node => isTransactionNode(node) && node.value.transaction === 'child'
        )!;
        TraceTree.FromSpans(child, pathSiblingAutogroupSpans, makeEventTransaction());
        TraceTree.AutogroupSiblingSpanNodes(tree.root);

        const siblingAutogroup = TraceTree.Find(tree.root, node =>
          isSiblingAutogroupedNode(node)
        ) as SiblingAutogroupNode;

        const path = TraceTree.PathToNode(siblingAutogroup.children[1]!);
        expect(path).toEqual(['span-1', 'txn-child-event-id']);
      });
    });

    it('path to missing instrumentation node', () => {
      const tree = TraceTree.FromTrace(nestedTransactionTrace, traceMetadata);

      const missingInstrumentationSpans = [
        makeSpan({
          op: 'db',
          description: 'redis',
          span_id: '0',
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

      const child = TraceTree.Find(
        tree.root,
        node => isTransactionNode(node) && node.value.transaction === 'child'
      )!;
      TraceTree.FromSpans(child, missingInstrumentationSpans, makeEventTransaction());
      TraceTree.DetectMissingInstrumentation(tree.root);

      const missingInstrumentationNode = TraceTree.Find(tree.root, node =>
        isMissingInstrumentationNode(node)
      )!;

      const path = TraceTree.PathToNode(missingInstrumentationNode);
      expect(path).toEqual(['ms-0', 'txn-child-event-id']);
    });
  });

  describe('ExpandToPath', () => {
    const organization = OrganizationFixture();
    const api = new MockApiClient();

    const nestedTransactionTrace = makeTrace({
      transactions: [
        makeTransaction({
          start_timestamp: start,
          timestamp: start + 2,
          transaction: 'parent',
          span_id: 'parent-span-id',
          event_id: 'parent-event-id',
          children: [
            makeTransaction({
              start_timestamp: start + 1,
              timestamp: start + 4,
              transaction: 'child',
              event_id: 'child-event-id',
              project_slug: 'project',
            }),
          ],
        }),
      ],
    });

    it('expands transactions from path segments', async () => {
      const tree = TraceTree.FromTrace(nestedTransactionTrace, traceMetadata);

      const child = TraceTree.Find(
        tree.root,
        node => isTransactionNode(node) && node.value.transaction === 'child'
      )!;

      await TraceTree.ExpandToPath(tree, TraceTree.PathToNode(child), {
        api,
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('discards non txns segments', async () => {
      const tree = TraceTree.FromTrace(nestedTransactionTrace, traceMetadata);

      const child = TraceTree.Find(
        tree.root,
        node => isTransactionNode(node) && node.value.transaction === 'child'
      )!;

      const request = mockSpansResponse([makeSpan()], 'project', 'child-event-id');
      await TraceTree.ExpandToPath(tree, ['span-0', ...TraceTree.PathToNode(child)], {
        api,
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(request).toHaveBeenCalled();
      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });
});
