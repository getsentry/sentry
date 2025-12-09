import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';

import {
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
  isSpanNode,
  isTransactionNode,
} from './../traceGuards';
import type {BaseNode} from './traceTreeNode/baseNode';
import type {EapSpanNode} from './traceTreeNode/eapSpanNode';
import type {ParentAutogroupNode} from './traceTreeNode/parentAutogroupNode';
import type {SiblingAutogroupNode} from './traceTreeNode/siblingAutogroupNode';
import type {UptimeCheckNode} from './traceTreeNode/uptimeCheckNode';
import type {UptimeCheckTimingNode} from './traceTreeNode/uptimeCheckTimingNode';
import {TraceShape, TraceTree} from './traceTree';
import {
  assertEAPSpanNode,
  assertTransactionNode,
  makeEAPError,
  makeEAPOccurrence,
  makeEAPSpan,
  makeEAPTrace,
  makeSpan,
  makeTrace,
  makeTraceError,
  makeTracePerformanceIssue,
  makeTransaction,
  makeUptimeCheck,
  mockSpansResponse,
} from './traceTreeTestUtils';

const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;
const end = new Date('2024-02-29T00:00:00Z').getTime() / 1e3 + 5;

const organization = OrganizationFixture();

const traceOptions = {replay: null, meta: null, organization};
const autogroupOptions = {organization};

const trace = makeTrace({
  transactions: [
    makeTransaction({
      event_id: 'event-id',
      project_slug: 'project',
      start_timestamp: start,
      timestamp: start + 2,
      children: [makeTransaction({start_timestamp: start + 1, timestamp: start + 4})],
    }),
  ],
  orphan_errors: [],
});

const eapTrace = makeEAPTrace([
  makeEAPSpan({
    start_timestamp: start,
    end_timestamp: start + 2,
    children: [makeEAPSpan({start_timestamp: start + 1, end_timestamp: start + 4})],
  }),
]);

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

const eapTraceWithErrors = makeEAPTrace([
  makeEAPSpan({
    event_id: 'eap-span-1',
    is_transaction: true,
    errors: [],
    description: 'EAP span with error',
    children: [
      makeEAPSpan({
        event_id: 'eap-span-2',
        is_transaction: false,
        errors: [makeEAPError({event_id: 'eap-error-1'})],
      }),
    ],
  }),
]);

const eapTraceWithOccurences = makeEAPTrace([
  makeEAPSpan({
    event_id: 'eap-span-1',
    is_transaction: true,
    occurrences: [],
    children: [
      makeEAPSpan({
        event_id: 'eap-span-2',
        is_transaction: false,
        occurrences: [makeEAPOccurrence({event_id: 'eap-occurence-1'})],
      }),
    ],
  }),
]);

const eapTraceWithOrphanErrors = makeEAPTrace([
  makeEAPError({
    event_id: 'eap-error-1',
    description: 'Error description 1',
    level: 'error',
  }),
  makeEAPError({
    event_id: 'eap-error-2',
    description: 'Error description 2',
    level: 'info',
  }),
]);

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
        traceOptions
      );
      expect(tree.root.children[0]!.errors.size).toBe(1);
    });

    it('stores trace error as error on node', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          orphan_errors: [makeTraceError()],
        }),
        traceOptions
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
        traceOptions
      );
      expect(tree.root.children[0]!.children[0]!.occurrences.size).toBe(1);
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
        traceOptions
      );
      expect(tree.root.children[0]!.children[0]!.profileId).toBe('profile-id');
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
        traceOptions
      );
      expect(tree.root.children[0]!.children[0]!.profilerId).toBe('profile-id');
    });
  });

  describe('adjusts trace start and end', () => {
    it('based off min(events.start_timestamp)', () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);
      expect(tree.root.space[0]).toBe(trace.transactions[0]!.start_timestamp * 1e3);
    });

    it('based off max(events.timestamp)', () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);
      expect(tree.root.space[1]).toBe(4000);
    });

    // This happnes for errors only traces
    it('end,0 when we cannot construct a timeline', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({orphan_errors: [makeTraceError({level: 'error', timestamp: end})]}),
        traceOptions
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
        traceOptions
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
        traceOptions
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
          replay: ReplayRecordFixture({
            started_at: new Date(replayStart),
            finished_at: new Date(replayEnd),
          }),
          organization,
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
        traceOptions
      );
      expect(tree.root.space).toEqual([start * 1e3 - 5000, 10_000]);
    });
  });

  describe('indicators', () => {
    it('measurements are converted to indicators', () => {
      const measurementValue = 1;
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: start,
              timestamp: start + 2,
              measurements: {ttfb: {value: measurementValue, unit: 'millisecond'}},
            }),
          ],
        }),
        traceOptions
      );
      expect(tree.indicators).toHaveLength(1);
      expect(tree.indicators[0]!.start).toBe(start * 1e3 + measurementValue);
    });

    it('zero measurements are not converted to indicators', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: start,
              timestamp: start + 2,
              measurements: {ttfb: {value: 0, unit: 'millisecond'}},
            }),
          ],
        }),
        traceOptions
      );
      expect(tree.indicators).toHaveLength(0);
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
        traceOptions
      );
      expect(tree.indicators).toHaveLength(2);
      expect(tree.indicators[0]!.start < tree.indicators[1]!.start).toBe(true);
    });
  });

  describe('FromTrace', () => {
    it('assembles tree from trace', () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('sorts by start_timestamp', () => {
      const tree = TraceTree.FromTrace(outOfOrderTrace, traceOptions);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('inserts orphan error', () => {
      const tree = TraceTree.FromTrace(traceWithOrphanError, {
        meta: null,
        replay: null,
        organization,
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('if parent span does not exist in span tree, the transaction stays under its previous parent', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: 100,
              transaction: 'root',
              children: [
                makeTransaction({transaction: 'child', parent_span_id: 'does not exist'}),
              ],
              project_slug: 'project',
              event_id: 'event-id',
            }),
          ],
        }),
        traceOptions
      );

      expect(tree.build().serialize()).toMatchSnapshot();

      mockSpansResponse([makeSpan({span_id: '0000'})], 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('swaps only pageload transaction child with parent http.server transaction', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              'transaction.op': 'http.server',
              transaction: '/api-1/',
              start_timestamp: 2,
              children: [
                makeTransaction({
                  'transaction.op': 'pageload',
                  transaction: '/',
                  start_timestamp: 1,
                  children: [
                    makeTransaction({
                      'transaction.op': 'http.server',
                      transaction: '/api-2/',
                      start_timestamp: 4,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        traceOptions
      );

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
            transaction_child_count_map: {
              transaction: 10,
              'no-spans-transaction': 1,
              // we have no data for child transaction
            },
            errors: 0,
            performance_issues: 0,
            projects: 0,
            transactions: 0,
            span_count: 0,
            span_count_map: {},
          },
          replay: null,
          organization,
        }
      );

      expect(tree.root.findChild(n => n.id === 'transaction')?.canFetchChildren).toBe(
        true
      );
      expect(
        tree.root.findChild(n => n.id === 'no-span-count-transaction')?.canFetchChildren
      ).toBe(true);
      expect(
        tree.root.findChild(n => n.id === 'no-spans-transaction')?.canFetchChildren
      ).toBe(false);
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
        {meta: null, replay: null, organization}
      );

      expect(tree.root.findChild(n => n.id === 'transaction')?.canFetchChildren).toBe(
        true
      );
    });
  });

  describe('eap trace', () => {
    it('assembles tree from eap trace', () => {
      const tree = TraceTree.FromTrace(eapTrace, traceOptions);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('assembles tree from eap trace with only errors', () => {
      const tree = TraceTree.FromTrace(eapTraceWithOrphanErrors, traceOptions);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('adds eap errors to tree nodes', () => {
      const tree = TraceTree.FromTrace(eapTraceWithErrors, traceOptions);

      expect(tree.root.children[0]!.errors.size).toBe(1);

      const eapTransaction = tree.root.findChild(n => n.id === 'eap-span-1');
      const eapSpan = tree.root.findChild(n => n.id === 'eap-span-2');

      expect(eapTransaction?.errors.size).toBe(1);
      expect(eapSpan?.errors.size).toBe(1);
    });

    it('adds eap occurences to tree nodes', () => {
      const tree = TraceTree.FromTrace(eapTraceWithOccurences, traceOptions);

      expect(tree.root.children[0]!.occurrences.size).toBe(1);

      const eapTransaction = tree.root.findChild(n => n.id === 'eap-span-1');
      const eapSpan = tree.root.findChild(n => n.id === 'eap-span-2');

      expect(eapTransaction?.occurrences.size).toBe(1);
      expect(eapSpan?.occurrences.size).toBe(1);
    });

    it('initializes eap span ops breakdown', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'eap-span-1',
            is_transaction: true,
            op: 'op-1',
            occurrences: [],
            children: [
              makeEAPSpan({
                event_id: 'eap-span-2',
                is_transaction: false,
                op: 'op-2',
                children: [
                  makeEAPSpan({
                    event_id: 'eap-span-4',
                    is_transaction: false,
                    op: 'op-3',
                    occurrences: [],
                    children: [],
                  }),
                ],
              }),
              makeEAPSpan({
                event_id: 'eap-span-3',
                is_transaction: true,
                op: 'op-2',
                occurrences: [],
                children: [],
              }),
            ],
          }),
        ]),
        traceOptions
      );

      const eapSpan1 = tree.root.findChild(n => n.id === 'eap-span-1');
      expect((eapSpan1 as EapSpanNode).opsBreakdown).toEqual(
        expect.arrayContaining([
          {op: 'op-2', count: 2},
          {op: 'op-3', count: 1},
        ])
      );

      const eapSpan2 = tree.root.findChild(n => n.id === 'eap-span-2');
      expect((eapSpan2 as EapSpanNode).opsBreakdown).toEqual(
        expect.arrayContaining([{op: 'op-3', count: 1}])
      );

      const eapSpan3 = tree.root.findChild(n => n.id === 'eap-span-3');
      expect((eapSpan3 as EapSpanNode).opsBreakdown).toEqual([]);

      const eapSpan4 = tree.root.findChild(n => n.id === 'eap-span-4');
      expect((eapSpan4 as EapSpanNode).opsBreakdown).toEqual([]);
    });

    it('initializes expanded based on is_transaction property', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'eap-span-1',
            start_timestamp: start,
            end_timestamp: start + 2,
            is_transaction: true,
            children: [
              makeEAPSpan({
                event_id: 'eap-span-2',
                start_timestamp: start + 1,
                end_timestamp: start + 4,
                is_transaction: false,
                children: [],
              }),
            ],
          }),
        ]),
        {meta: null, replay: null, organization}
      );

      // eap-span-1 is a transaction/segment and should be collapsed
      expect(tree.root.findChild(n => n.id === 'eap-span-1')?.expanded).toBe(false);

      // eap-span-2 is a span and should be expanded
      expect(tree.root.findChild(n => n.id === 'eap-span-2')?.expanded).toBe(true);
    });

    it('correctly renders eap-transactions toggle state', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'eap-span-1',
            start_timestamp: start,
            end_timestamp: start + 2,
            is_transaction: true, // is a transaction
            parent_span_id: undefined,
            children: [
              makeEAPSpan({
                event_id: 'eap-span-2',
                start_timestamp: start + 1,
                end_timestamp: start + 4,
                is_transaction: false,
                parent_span_id: 'eap-span-1',
                children: [
                  makeEAPSpan({
                    event_id: 'eap-span-3',
                    start_timestamp: start + 2,
                    end_timestamp: start + 3,
                    is_transaction: true, // is a transaction
                    parent_span_id: 'eap-span-2',
                    children: [
                      makeEAPSpan({
                        event_id: 'eap-span-4',
                        start_timestamp: start + 3,
                        end_timestamp: start + 4,
                        is_transaction: false,
                        parent_span_id: 'eap-span-3',
                        children: [
                          makeEAPSpan({
                            event_id: 'eap-span-5',
                            start_timestamp: start + 4,
                            end_timestamp: start + 5,
                            is_transaction: true, // is a transaction
                            parent_span_id: 'eap-span-4',
                            children: [],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ]),
        traceOptions
      );

      // Assert initial state
      expect(tree.build().serialize()).toMatchSnapshot();

      // Assert expaneded state
      const eapTxn = tree.root.findChild(n => n.id === 'eap-span-1');
      eapTxn!.expand(true, tree);
      expect(tree.build().serialize()).toMatchSnapshot();

      // Assert state upon collapsing
      eapTxn!.expand(false, tree);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('collects measurements', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'eap-span-1',
            start_timestamp: start,
            end_timestamp: start + 2,
            is_transaction: true,
            measurements: {
              'measurements.fcp': 100,
              'measurements.lcp': 200,
            },
            children: [
              makeEAPSpan({
                event_id: 'eap-span-2',
                start_timestamp: start + 1,
                end_timestamp: start + 4,
                is_transaction: false,
                children: [],
              }),
            ],
          }),
        ]),
        {meta: null, replay: null, organization}
      );

      expect(tree.vitals.size).toBe(1);

      const span1 = tree.root.findChild(n => n.id === 'eap-span-1');
      expect(tree.vitals.get(span1!)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({key: 'fcp', measurement: {value: 100}}),
          expect.objectContaining({key: 'lcp', measurement: {value: 200}}),
        ])
      );

      expect(tree.indicators).toEqual(
        expect.arrayContaining([
          expect.objectContaining({type: 'fcp', label: 'FCP', measurement: {value: 100}}),
          expect.objectContaining({type: 'lcp', label: 'LCP', measurement: {value: 200}}),
        ])
      );
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

      const tree = TraceTree.FromTrace(t, traceOptions);

      const listener = jest.fn();
      tree.on('trace timeline change', listener);

      const txn = tree.root.findChild(n => isTransactionNode(n))!;

      mockSpansResponse(
        [makeSpan({start_timestamp: start + 0.5, timestamp: start + 1})],
        'project',
        'event-id'
      );

      await tree.fetchNodeSubTree(true, txn, {
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
        api: new MockApiClient(),
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
      const tree = TraceTree.FromTrace(t, traceOptions);

      const listener = jest.fn();
      tree.on('trace timeline change', listener);

      const txn = tree.root.findChild(n => isTransactionNode(n))!;

      const transactionSpaceBounds = JSON.stringify(txn.space);

      mockSpansResponse(
        [makeSpan({start_timestamp: start, timestamp: start + 1.2})],
        'project',
        'event-id'
      );

      await tree.fetchNodeSubTree(true, txn, {
        api: new MockApiClient(),
        organization,
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
        {meta: null, replay: null, organization}
      );

      const visitedNodes: string[] = [];
      tree.root.forEachChild(node => {
        if (isTransactionNode(node)) {
          visitedNodes.push(node.value.transaction);
        }
      });

      expect(visitedNodes).toEqual(['root', 'child', 'other_child']);
    });
  });

  describe('expand', () => {
    it('expanding a parent autogroup node shows head to tail chain', async () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);

      mockSpansResponse(parentAutogroupSpansWithTailChildren, 'project', 'event-id');

      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const parentAutogroupNode = tree.root.findChild(n => isParentAutogroupedNode(n))!;

      parentAutogroupNode.expand(true, tree);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('collapsing a parent autogroup node shows tail chain', async () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);
      mockSpansResponse(parentAutogroupSpansWithTailChildren, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const parentAutogroupNode = tree.root.findChild(n => isParentAutogroupedNode(n))!;
      parentAutogroupNode.expand(true, tree);
      parentAutogroupNode.expand(false, tree);

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('collapsing intermediary children is preserved', async () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);
      mockSpansResponse(parentAutogroupSpansWithTailChildren, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const parentAutogroupNode = tree.root.findChild(n =>
        isParentAutogroupedNode(n)
      ) as ParentAutogroupNode;

      // Expand the chain and collapse an intermediary child
      parentAutogroupNode.expand(true, tree);
      parentAutogroupNode.head.expand(false, tree);

      const snapshot = tree.build().serialize();

      // Collapse the autogroup node and expand it again
      parentAutogroupNode.expand(false, tree);
      parentAutogroupNode.expand(true, tree);

      // Assert that the snapshot is preserved and we only render the parent autogroup chain
      // up to the collapsed span
      expect(tree.build().serialize()).toEqual(snapshot);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('expanding a sibling autogroup node shows sibling span', async () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);
      mockSpansResponse(siblingAutogroupSpans, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      tree.root.forEachChild(n => {
        if (isSiblingAutogroupedNode(n)) {
          n.expand(true, tree);
        }
      });
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('collapsing a sibling autogroup node hides children', async () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);
      mockSpansResponse(siblingAutogroupSpans, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      tree.root.forEachChild(n => {
        if (isSiblingAutogroupedNode(n)) {
          n.expand(true, tree);
        }
      });

      tree.root.forEachChild(n => {
        if (isSiblingAutogroupedNode(n)) {
          n.expand(false, tree);
        }
      });
      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });

  describe('zoom', () => {
    it('does nothing if node cannot fetch', async () => {
      const tree = TraceTree.FromTrace(traceWithEventId, traceOptions);
      const request = mockSpansResponse([], 'project', 'event-id');

      tree.root.children[0]!.children[0]!.canFetchChildren = false;
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(request).not.toHaveBeenCalled();
    });

    it('caches promise', async () => {
      const tree = TraceTree.FromTrace(traceWithEventId, traceOptions);
      const request = mockSpansResponse([], 'project', 'event-id');

      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
        api: new MockApiClient(),
      });
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('zooms in on transaction node', async () => {
      const tree = TraceTree.FromTrace(traceWithEventId, traceOptions);

      mockSpansResponse([makeSpan()], 'project', 'child-event-id');

      // Zoom mutates the list, so we need to build first
      tree.build();

      await tree.fetchNodeSubTree(
        true,
        tree.root.children[0]!.children[0]!.children[0]!,
        {
          api: new MockApiClient(),
          organization,
          preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
        }
      );

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('maintains the span tree when parent is zoomed in', async () => {
      const tree = TraceTree.FromTrace(traceWithEventId, traceOptions);
      // Zoom mutates the list, so we need to build first
      tree.build();
      // Zoom in on child span
      mockSpansResponse([makeSpan()], 'project', 'child-event-id');
      await tree.fetchNodeSubTree(
        true,
        tree.root.children[0]!.children[0]!.children[0]!,
        {
          api: new MockApiClient(),
          organization,
          preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
        }
      );

      // Then zoom in on a parent
      mockSpansResponse([makeSpan()], 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
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
        traceOptions
      );

      // Zoom mutates the list, so we need to build first
      tree.build();

      mockSpansResponse([makeSpan({span_id: '0001'})], 'project', 'child-event-id');
      await tree.fetchNodeSubTree(
        true,
        tree.root.children[0]!.children[0]!.children[0]!,
        {
          organization,
          preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
          api: new MockApiClient(),
        }
      );

      mockSpansResponse([makeSpan({span_id: '0000'})], 'project', 'parent-event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
        api: new MockApiClient(),
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
        traceOptions
      );

      // Zoom mutates the list, so we need to build first
      tree.build();

      mockSpansResponse([makeSpan({span_id: '0000'})], 'project', 'parent-event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const grandchild = tree.root.findChild(
        node => isTransactionNode(node) && node.value.event_id === 'grandchild-event-id'
      );
      const child = tree.root.findChild(
        node => isTransactionNode(node) && node.value.event_id === 'child-event-id'
      );

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
        traceOptions
      );

      // Zoom mutates the list, so we need to build first
      const transactionTreeSnapshot = tree.build().serialize();

      mockSpansResponse([makeSpan({span_id: '0000'})], 'project', 'parent-event-id');
      for (const bool of [true, false]) {
        await tree.fetchNodeSubTree(bool, tree.root.children[0]!.children[0]!, {
          api: new MockApiClient(),
          organization,
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
        traceOptions
      );

      // Zoom mutates the list, so we need to build first
      tree.build();

      mockSpansResponse(
        [makeSpan({span_id: '0000', op: 'parent-op'})],
        'project',
        'child-event-id'
      );

      const child = tree.root.findChild(
        node => isTransactionNode(node) && node.value.event_id === 'child-event-id'
      );
      await tree.fetchNodeSubTree(true, child!, {
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
        api: new MockApiClient(),
      });

      mockSpansResponse(
        [makeSpan({span_id: '0001', op: 'child-op'})],
        'project',
        'grandchild-event-id'
      );

      const grandchild = tree.root.findChild(
        node => isTransactionNode(node) && node.value.event_id === 'grandchild-event-id'
      );
      await tree.fetchNodeSubTree(true, grandchild!, {
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
        api: new MockApiClient(),
      });

      await tree.fetchNodeSubTree(false, child!, {
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
        api: new MockApiClient(),
      });

      const spans = tree.root.findAllChildren(n => isSpanNode(n));
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
        traceOptions
      );

      const node = tree.root.findChild(n => isTransactionNode(n));
      expect(node).not.toBeNull();
      expect((node as any).value.transaction).toBe('first');
    });
    it('returns null if no node is found', () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);
      const node = tree.root.findChild(n => (n as any) === 'does not exist');
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
      const tree = TraceTree.FromTrace(traceWithError, traceOptions);
      const node = tree.root.findChild(n => n.matchById('first-event-id'));

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
      const tree = TraceTree.FromTrace(traceWithError, traceOptions);

      const node = tree.root.findChild(n => n.matchById('error-event-id'));

      assertTransactionNode(node);
      expect(node.value.transaction).toBe('first');
    });

    it('finds eap error by event_id', () => {
      const tree = TraceTree.FromTrace(eapTraceWithErrors, traceOptions);
      const node = tree.root.findChild(n => n.matchById('eap-error-1'));

      assertEAPSpanNode(node);
      expect(node.value.description).toBe('EAP span with error');
    });
  });

  describe('FindAll', () => {
    it('finds all nodes by predicate', () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);
      const nodes = tree.root.findAllChildren(n => isTransactionNode(n));
      expect(nodes).toHaveLength(2);
    });
  });

  describe('DirectVisibleChildren', () => {
    it('returns children for transaction', () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);
      expect(tree.root.children[0]!.directVisibleChildren).toEqual(
        tree.root.children[0]!.children
      );
    });

    it('returns tail for collapsed parent autogroup', async () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);

      mockSpansResponse(parentAutogroupSpansWithTailChildren, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
      });

      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

      const parentAutogroup = tree.root.findChild(node =>
        isParentAutogroupedNode(node)
      ) as ParentAutogroupNode;

      expect(parentAutogroup).not.toBeNull();
      expect(parentAutogroup.directVisibleChildren[0]).toBe(
        parentAutogroup.tail.children[0]
      );
    });
    it('returns head for expanded parent autogroup', async () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);

      mockSpansResponse(parentAutogroupSpans, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
      });

      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

      const parentAutogroup = tree.root.findChild(node =>
        isParentAutogroupedNode(node)
      ) as ParentAutogroupNode;

      parentAutogroup.expand(true, tree);

      expect(parentAutogroup.directVisibleChildren[0]).toBe(parentAutogroup.head);
    });
  });

  describe('HasVisibleChildren', () => {
    it('true when transaction has children', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [makeTransaction({children: [makeTransaction()]})],
        }),
        traceOptions
      );
      expect(tree.root.children[0]!.hasVisibleChildren()).toBe(true);
    });

    describe('span', () => {
      it.each([true, false])(
        '%s when span has children and is expanded',
        async expanded => {
          const tree = TraceTree.FromTrace(
            makeTrace({
              transactions: [
                makeTransaction({
                  children: [makeTransaction()],
                  event_id: 'event-id',
                  project_slug: 'project',
                }),
              ],
            }),
            traceOptions
          );

          mockSpansResponse(
            [
              makeSpan({span_id: '0000'}),
              makeSpan({span_id: '0001', parent_span_id: '0000'}),
            ],
            'project',
            'event-id'
          );
          await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
            api: new MockApiClient(),
            organization,
          });

          const span = tree.root.findChild(
            node => isSpanNode(node) && node.value.span_id === '0000'
          )!;

          span.expand(expanded, tree);
          expect(span.hasVisibleChildren()).toBe(expanded);
        }
      );
    });

    describe('sibling autogroup', () => {
      it.each([true, false])('%s when sibling autogroup is expanded', async expanded => {
        const tree = TraceTree.FromTrace(trace, traceOptions);

        mockSpansResponse(siblingAutogroupSpans, 'project', 'event-id');
        await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
          api: new MockApiClient(),
          organization,
        });

        TraceTree.AutogroupSiblingSpanNodes(tree.root, autogroupOptions);
        const siblingAutogroup = tree.root.findChild(node =>
          isSiblingAutogroupedNode(node)
        );

        siblingAutogroup!.expand(expanded, tree);
        expect(siblingAutogroup!.hasVisibleChildren()).toBe(expanded);
      });

      it("doesn't auto-group sibling spans with default op", async () => {
        const siblingSpans = [
          makeSpan({
            op: 'pageload',
            description: 'parent',
            start_timestamp: start,
            timestamp: start + 1,
            span_id: '0000',
          }),
          makeSpan({
            op: 'default',
            description: 'desc',
            start_timestamp: start,
            timestamp: start + 1,
            parent_span_id: '0000',
          }),
          makeSpan({
            op: 'default',
            description: 'desc',
            start_timestamp: start,
            timestamp: start + 1,
            parent_span_id: '0000',
          }),
          makeSpan({
            op: 'default',
            description: 'desc',
            start_timestamp: start,
            timestamp: start + 1,
            parent_span_id: '0000',
          }),
          makeSpan({
            op: 'default',
            description: 'desc',
            start_timestamp: start,
            timestamp: start + 1,
            parent_span_id: '0000',
          }),
          makeSpan({
            op: 'default',
            description: 'desc',
            start_timestamp: start,
            timestamp: start + 1,
            parent_span_id: '0000',
          }),
        ];

        const tree = TraceTree.FromTrace(trace, traceOptions);
        mockSpansResponse(siblingSpans, 'project', 'event-id');
        await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
          api: new MockApiClient(),
          organization,
        });

        TraceTree.AutogroupSiblingSpanNodes(tree.root, autogroupOptions);

        const siblingAutogroup = tree.root.findChild(node =>
          isSiblingAutogroupedNode(node)
        );
        expect(siblingAutogroup).toBeNull();
      });
    });

    describe('parent autogroup', () => {
      it.each([true, false])('%s when parent autogroup is expanded', async expanded => {
        const tree = TraceTree.FromTrace(trace, traceOptions);

        mockSpansResponse(parentAutogroupSpans, 'project', 'event-id');
        await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
          api: new MockApiClient(),
          organization,
        });

        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
        const parentAutogroup = tree.root.findChild(node =>
          isParentAutogroupedNode(node)
        );

        parentAutogroup!.expand(expanded, tree);
        expect(parentAutogroup!.hasVisibleChildren()).toBe(expanded);
      });

      it("does't auto-group child spans with default op", async () => {
        const childSpans = [
          makeSpan({op: 'default', description: 'desc1', span_id: '0000'}),
          makeSpan({
            op: 'default',
            description: 'desc2',
            span_id: '0001',
            parent_span_id: '0000',
          }),
        ];

        const tree = TraceTree.FromTrace(trace, traceOptions);
        mockSpansResponse(childSpans, 'project', 'event-id');
        await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
          api: new MockApiClient(),
          organization,
        });

        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

        const parentAutogroup = tree.root.findChild(node =>
          isParentAutogroupedNode(node)
        );
        expect(parentAutogroup).toBeNull();
      });
    });

    describe('parent autogroup when tail has children', () => {
      // Always true because tail has children
      it.each([true, false])('%s when parent autogroup is expanded', async expanded => {
        const tree = TraceTree.FromTrace(trace, traceOptions);

        mockSpansResponse(parentAutogroupSpansWithTailChildren, 'project', 'event-id');
        await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
          api: new MockApiClient(),
          organization,
        });

        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
        tree.build();

        const parentAutogroup = tree.root.findChild(node =>
          isParentAutogroupedNode(node)
        );

        parentAutogroup!.expand(expanded, tree);
        expect(parentAutogroup!.hasVisibleChildren()).toBe(true);
      });
    });
  });

  describe('IsLastChild', () => {
    it('returns false if node is not last child', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [makeTransaction(), makeTransaction()],
        }),
        traceOptions
      );
      expect(tree.root.children[0]!.children[0]!.isLastChild()).toBe(false);
    });
    it('returns true if node is last child', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [makeTransaction(), makeTransaction()],
        }),
        traceOptions
      );
      expect(tree.root.children[0]!.children[1]!.isLastChild()).toBe(true);
    });
  });

  describe('Invalidate', () => {
    it('invalidates node', () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);
      tree.root.children[0]!.depth = 10;
      tree.root.children[0]!.connectors = [1, 2, 3];

      tree.root.children[0]!.invalidate();
      expect(tree.root.children[0]!.depth).toBeUndefined();
      expect(tree.root.children[0]!.connectors).toBeUndefined();
    });
    it('recursively invalidates children', () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);
      tree.root.children[0]!.depth = 10;
      tree.root.children[0]!.connectors = [1, 2, 3];
      tree.root.children[0]!.invalidate();
      tree.root.children[0]!.forEachChild(child => child.invalidate());
      expect(tree.root.children[0]!.depth).toBeUndefined();
      expect(tree.root.children[0]!.connectors).toBeUndefined();
    });
  });

  describe('appendTree', () => {
    it('appends tree to end of current tree', () => {
      const tree = TraceTree.FromTrace(trace, {replay: null, meta: null, organization});
      tree.appendTree(
        TraceTree.FromTrace(trace, {replay: null, meta: null, organization})
      );
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('appending extends trace space', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [makeTransaction({start_timestamp: start, timestamp: start + 1})],
        }),
        {replay: null, meta: null, organization}
      );

      const otherTree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({start_timestamp: start, timestamp: start + 10}),
          ],
        }),
        {replay: null, meta: null, organization}
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
          project_slug: 'project',
          children: [
            makeTransaction({
              start_timestamp: start + 1,
              timestamp: start + 4,
              transaction: 'child',
              project_slug: 'project',
              event_id: 'child-event-id',
            }),
          ],
        }),
      ],
    });

    it('path to transaction node', () => {
      const tree = TraceTree.FromTrace(nestedTransactionTrace, traceOptions);
      const transactionNode = tree.root.findChild(
        node => isTransactionNode(node) && node.value.transaction === 'child'
      )!;

      const path = transactionNode.pathToNode();
      expect(path).toEqual(['txn-child-event-id']);
    });

    it('path to span includes parent txn', async () => {
      const tree = TraceTree.FromTrace(nestedTransactionTrace, traceOptions);
      const child = tree.root.findChild(
        node => isTransactionNode(node) && node.value.transaction === 'child'
      )!;

      mockSpansResponse([makeSpan({span_id: 'span-id'})], 'project', 'child-event-id');
      await tree.fetchNodeSubTree(true, child, {
        api: new MockApiClient(),
        organization,
      });

      const span = tree.root.findChild(node => isSpanNode(node))!;
      const path = span.pathToNode();
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
      it('parent autogroup', async () => {
        const tree = TraceTree.FromTrace(nestedTransactionTrace, traceOptions);
        const child = tree.root.findChild(
          node => isTransactionNode(node) && node.value.transaction === 'child'
        )!;
        mockSpansResponse(pathParentAutogroupSpans, 'project', 'child-event-id');
        await tree.fetchNodeSubTree(true, child, {
          api: new MockApiClient(),
          organization,
        });
        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

        const parentAutogroup = tree.root.findChild(node =>
          isParentAutogroupedNode(node)
        )!;

        const path = parentAutogroup.pathToNode();
        expect(path).toEqual(['ag-head-span-id', 'txn-child-event-id']);
      });
      it('path to child of parent autogroup skips autogroup', async () => {
        const tree = TraceTree.FromTrace(nestedTransactionTrace, traceOptions);
        const child = tree.root.findChild(
          node => isTransactionNode(node) && node.value.transaction === 'child'
        )!;
        mockSpansResponse(pathParentAutogroupSpans, 'project', 'child-event-id');
        await tree.fetchNodeSubTree(true, child, {
          api: new MockApiClient(),
          organization,
        });
        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

        const parentAutogroup = tree.root.findChild(node =>
          isParentAutogroupedNode(node)
        ) as ParentAutogroupNode;
        expect(parentAutogroup.tail.pathToNode()).toEqual([
          'span-tail-span-id',
          'txn-child-event-id',
        ]);

        const requestSpan = tree.root.findChild(
          node => isSpanNode(node) && node.value.description === 'request'
        )!;
        expect(requestSpan.pathToNode()).toEqual([
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
      it('path to sibling autogroup', async () => {
        const tree = TraceTree.FromTrace(nestedTransactionTrace, traceOptions);
        const child = tree.root.findChild(
          node => isTransactionNode(node) && node.value.transaction === 'child'
        )!;
        mockSpansResponse(pathSiblingAutogroupSpans, 'project', 'child-event-id');
        await tree.fetchNodeSubTree(true, child, {
          api: new MockApiClient(),
          organization,
        });
        TraceTree.AutogroupSiblingSpanNodes(tree.root, autogroupOptions);

        const siblingAutogroup = tree.root.findChild(node =>
          isSiblingAutogroupedNode(node)
        ) as SiblingAutogroupNode;

        const path = siblingAutogroup.pathToNode();
        expect(path).toEqual(['ag-child-event-id', 'txn-child-event-id']);
      });

      it('path to child of sibling autogroup skips autogroup', async () => {
        const tree = TraceTree.FromTrace(nestedTransactionTrace, traceOptions);
        const child = tree.root.findChild(
          node => isTransactionNode(node) && node.value.transaction === 'child'
        )!;
        mockSpansResponse(pathSiblingAutogroupSpans, 'project', 'child-event-id');
        await tree.fetchNodeSubTree(true, child, {
          api: new MockApiClient(),
          organization,
        });
        TraceTree.AutogroupSiblingSpanNodes(tree.root, autogroupOptions);

        const siblingAutogroup = tree.root.findChild(node =>
          isSiblingAutogroupedNode(node)
        ) as SiblingAutogroupNode;

        const path = siblingAutogroup.children[1]!.pathToNode();
        expect(path).toEqual(['span-1', 'txn-child-event-id']);
      });
    });

    it('path to missing instrumentation node', async () => {
      const tree = TraceTree.FromTrace(nestedTransactionTrace, traceOptions);

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

      const child = tree.root.findChild(
        node => isTransactionNode(node) && node.value.transaction === 'child'
      )!;
      mockSpansResponse(missingInstrumentationSpans, 'project', 'child-event-id');
      await tree.fetchNodeSubTree(true, child, {
        api: new MockApiClient(),
        organization,
      });
      TraceTree.DetectMissingInstrumentation(tree.root);

      const missingInstrumentationNode = tree.root.findChild(node =>
        isMissingInstrumentationNode(node)
      )!;

      const path = missingInstrumentationNode.pathToNode();
      expect(path[0]).toMatch(/^ms-0/);
      expect(path[1]).toBe('txn-child-event-id');
    });
  });

  describe('ExpandToPath', () => {
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
      const tree = TraceTree.FromTrace(nestedTransactionTrace, traceOptions);

      const child = tree.root.findChild(
        node => isTransactionNode(node) && node.value.transaction === 'child'
      )!;

      await TraceTree.ExpandToPath(tree, child.pathToNode(), {
        api,
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('discards non txns segments', async () => {
      const tree = TraceTree.FromTrace(nestedTransactionTrace, traceOptions);

      const child = tree.root.findChild(
        node => isTransactionNode(node) && node.value.transaction === 'child'
      )!;

      const request = mockSpansResponse([makeSpan()], 'project', 'child-event-id');
      await TraceTree.ExpandToPath(tree, ['span-0', ...child.pathToNode()], {
        api,
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(request).toHaveBeenCalled();
      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });

  describe('printTraceTreeNode', () => {
    it('adds prefetch prefix to spans with http.request.prefetch attribute', async () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);

      const prefetchSpan = makeSpan({
        op: 'http',
        description: 'GET /api/users',
        data: {
          'http.request.prefetch': true,
        },
      });

      const regularSpan = makeSpan({
        op: 'http',
        description: 'GET /api/users',
      });

      mockSpansResponse([prefetchSpan, regularSpan], 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
        api: new MockApiClient(),
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('handles falsy prefetch attribute', async () => {
      const tree = TraceTree.FromTrace(trace, traceOptions);

      const falsePrefetchSpan = makeSpan({
        op: 'http',
        description: 'GET /api/users',
        data: {
          'http.request.prefetch': false,
        },
      });

      mockSpansResponse([falsePrefetchSpan], 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });

  describe('uptime check integration', () => {
    function isUptimeCheckTimingNode(node: BaseNode): node is UptimeCheckTimingNode {
      return !!(
        node.value &&
        'event_type' in node.value &&
        node.value.event_type === 'uptime_check_timing'
      );
    }

    function isUptimeCheckNode(node: BaseNode): node is UptimeCheckNode {
      return !!(
        node.value &&
        'event_type' in node.value &&
        node.value.event_type === 'uptime_check'
      );
    }

    it('automatically creates timing nodes when uptime check node is created', () => {
      const uptimeCheck = makeUptimeCheck({
        additional_attributes: {
          dns_lookup_duration_us: '50000',
          dns_lookup_start_us: '0',
          tcp_connection_duration_us: '100000',
          tcp_connection_start_us: '50000',
          tls_handshake_duration_us: '200000',
          tls_handshake_start_us: '150000',
          send_request_duration_us: '25000',
          send_request_start_us: '350000',
          time_to_first_byte_duration_us: '500000',
          time_to_first_byte_start_us: '375000',
          receive_response_duration_us: '100000',
          receive_response_start_us: '875000',
        },
      });

      const tree = TraceTree.FromTrace([uptimeCheck], traceOptions);

      // Find the uptime check node in the tree
      const uptimeNode = tree.root.findChild(node => isUptimeCheckNode(node));
      expect(uptimeNode).toBeDefined();

      // Check that timing nodes were automatically added as children
      const timingChildren = uptimeNode?.children.filter(child =>
        isUptimeCheckTimingNode(child)
      );
      expect(timingChildren).toHaveLength(6);

      // Verify each timing phase is present with correct metrics
      const dnsNode = timingChildren?.find(
        child => child.value.op === 'dns.lookup.duration'
      );
      expect(dnsNode).toBeDefined();
      expect(dnsNode?.value.description).toBe('DNS lookup');
      expect(dnsNode?.value.duration).toBe(0.05); // 50000us = 0.05s

      const tcpNode = timingChildren?.find(
        child => child.value.op === 'http.tcp_connection.duration'
      );
      expect(tcpNode).toBeDefined();
      expect(tcpNode?.value.description).toBe('TCP connect');
      expect(tcpNode?.value.duration).toBe(0.1); // 100000us = 0.1s

      const tlsNode = timingChildren?.find(
        child => child.value.op === 'tls.handshake.duration'
      );
      expect(tlsNode).toBeDefined();
      expect(tlsNode?.value.description).toBe('TLS handshake');
      expect(tlsNode?.value.duration).toBe(0.2); // 200000us = 0.2s

      const requestNode = timingChildren?.find(
        child => child.value.op === 'http.client.request.duration'
      );
      expect(requestNode).toBeDefined();
      expect(requestNode?.value.description).toBe('Send request');
      expect(requestNode?.value.duration).toBe(0.025); // 25000us = 0.025s

      const ttfbNode = timingChildren?.find(
        child => child.value.op === 'http.server.time_to_first_byte'
      );
      expect(ttfbNode).toBeDefined();
      expect(ttfbNode?.value.description).toBe('Waiting for response');
      expect(ttfbNode?.value.duration).toBe(0.5); // 500000us = 0.5s

      const responseNode = timingChildren?.find(
        child => child.value.op === 'http.client.response.duration'
      );
      expect(responseNode).toBeDefined();
      expect(responseNode?.value.description).toBe('Receive response');
      expect(responseNode?.value.duration).toBe(0.1); // 100000us = 0.1s
    });

    it('handles missing timing attributes gracefully', () => {
      const uptimeCheck = makeUptimeCheck({
        additional_attributes: {
          dns_lookup_duration_us: '50000',
          dns_lookup_start_us: '0',
          // Missing other timing attributes
        },
      });

      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              children: [uptimeCheck as any],
            }),
          ],
        }),
        traceOptions
      );

      const uptimeNode = tree.root.findChild(node => isUptimeCheckNode(node));
      const timingChildren = uptimeNode?.children.filter(child =>
        isUptimeCheckTimingNode(child)
      );

      expect(timingChildren).toHaveLength(6);

      // Should still create all nodes, but with 0 duration for missing attributes
      const tcpNode = timingChildren?.find(
        child => child.value.op === 'http.tcp_connection.duration'
      );
      expect(tcpNode?.value.duration).toBe(0);
    });
  });

  describe('shape', () => {
    describe('regular traces', () => {
      it('returns EMPTY_TRACE when trace has no transactions or errors', () => {
        const tree = TraceTree.FromTrace(
          makeTrace({
            transactions: [],
            orphan_errors: [],
          }),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.EMPTY_TRACE);
      });

      it('returns NO_ROOT when trace has only non-root transactions', () => {
        const tree = TraceTree.FromTrace(
          makeTrace({
            transactions: [
              makeTransaction({
                parent_span_id: 'some-parent-id',
                children: [],
              }),
              makeTransaction({
                parent_span_id: 'another-parent-id',
                children: [],
              }),
            ],
            orphan_errors: [],
          }),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.NO_ROOT);
      });

      it('returns ONLY_ERRORS when trace has only orphan errors', () => {
        const tree = TraceTree.FromTrace(
          makeTrace({
            transactions: [],
            orphan_errors: [makeTraceError()],
          }),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.ONLY_ERRORS);
      });

      it('returns ONE_ROOT when trace has exactly one root transaction', () => {
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
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.ONE_ROOT);
      });

      it('returns BROKEN_SUBTRACES when trace has one root and orphan spans', () => {
        const tree = TraceTree.FromTrace(
          makeTrace({
            transactions: [
              makeTransaction({
                parent_span_id: null,
                children: [],
              }),
              makeTransaction({
                parent_span_id: 'non-existent-parent',
                children: [],
              }),
            ],
            orphan_errors: [],
          }),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.BROKEN_SUBTRACES);
      });

      it('returns BROWSER_MULTIPLE_ROOTS when trace has multiple roots including JavaScript SDK events', () => {
        const tree = TraceTree.FromTrace(
          makeTrace({
            transactions: [
              makeTransaction({
                parent_span_id: null,
                sdk_name: 'sentry.javascript.browser',
                children: [],
              }),
              makeTransaction({
                parent_span_id: null,
                sdk_name: 'sentry.python',
                children: [],
              }),
            ],
            orphan_errors: [],
          }),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.BROWSER_MULTIPLE_ROOTS);
      });

      it('returns MULTIPLE_ROOTS when trace has multiple non-JavaScript roots', () => {
        const tree = TraceTree.FromTrace(
          makeTrace({
            transactions: [
              makeTransaction({
                parent_span_id: null,
                sdk_name: 'sentry.python',
                children: [],
              }),
              makeTransaction({
                parent_span_id: null,
                sdk_name: 'sentry.java',
                children: [],
              }),
            ],
            orphan_errors: [],
          }),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.MULTIPLE_ROOTS);
      });

      it('handles complex trace with multiple root types correctly', () => {
        const tree = TraceTree.FromTrace(
          makeTrace({
            transactions: [
              makeTransaction({
                parent_span_id: null,
                sdk_name: 'sentry.javascript.react',
                children: [],
              }),
              makeTransaction({
                parent_span_id: null,
                sdk_name: 'sentry.javascript.node',
                children: [],
              }),
              makeTransaction({
                parent_span_id: null,
                sdk_name: 'sentry.python',
                children: [],
              }),
            ],
            orphan_errors: [],
          }),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.BROWSER_MULTIPLE_ROOTS);
      });
    });

    describe('EAP traces', () => {
      it('returns EMPTY_TRACE for empty EAP trace', () => {
        const tree = TraceTree.FromTrace(makeEAPTrace([]), traceOptions);

        expect(tree.shape).toBe(TraceShape.EMPTY_TRACE);
      });

      it('returns ONLY_ERRORS for EAP trace with only errors', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace([
            makeEAPError({
              event_id: 'error-1',
              description: 'Test error',
            }),
            makeEAPError({
              event_id: 'error-2',
              description: 'Another error',
            }),
          ]),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.ONLY_ERRORS);
      });

      it('returns NO_ROOT for EAP trace with only non-root spans', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace([
            makeEAPSpan({
              parent_span_id: 'some-parent',
              is_transaction: false,
            }),
            makeEAPSpan({
              parent_span_id: 'another-parent',
              is_transaction: false,
            }),
          ]),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.NO_ROOT);
      });

      it('returns ONE_ROOT for EAP trace with single root span', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace([
            makeEAPSpan({
              parent_span_id: null,
              is_transaction: true,
              children: [
                makeEAPSpan({
                  parent_span_id: 'root-span-id',
                  is_transaction: false,
                }),
              ],
            }),
          ]),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.ONE_ROOT);
      });

      it('returns BROKEN_SUBTRACES for EAP trace with root and orphan spans', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace([
            makeEAPSpan({
              parent_span_id: null,
              is_transaction: true,
            }),
            makeEAPSpan({
              parent_span_id: 'non-existent-parent',
              is_transaction: false,
            }),
          ]),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.BROKEN_SUBTRACES);
      });

      it('returns BROWSER_MULTIPLE_ROOTS for EAP trace with multiple roots including JavaScript SDK', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace([
            makeEAPSpan({
              parent_span_id: null,
              is_transaction: true,
              transaction: 'pageload',
              sdk_name: 'sentry.javascript.browser',
              op: 'pageload',
            }),
            makeEAPSpan({
              parent_span_id: null,
              is_transaction: true,
              transaction: 'backend',
              op: 'http.server',
            }),
          ]),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.BROWSER_MULTIPLE_ROOTS);
      });

      it('returns MULTIPLE_ROOTS for EAP trace with multiple non-JavaScript roots', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace([
            makeEAPSpan({
              parent_span_id: null,
              is_transaction: true,
              transaction: 'backend-1',
              op: 'http.server',
            }),
            makeEAPSpan({
              parent_span_id: null,
              is_transaction: true,
              transaction: 'backend-2',
              op: 'db.query',
            }),
          ]),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.MULTIPLE_ROOTS);
      });

      it('handles mixed EAP trace with spans and errors correctly', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace([
            makeEAPSpan({
              parent_span_id: null,
              is_transaction: true,
              children: [],
            }),
            makeEAPError({
              event_id: 'error-1',
              description: 'Orphan error',
            }),
          ]),
          traceOptions
        );

        expect(tree.shape).toBe(TraceShape.ONE_ROOT);
      });
    });

    describe('edge cases', () => {
      it('handles trace with no trace node correctly', () => {
        const tree = TraceTree.FromTrace(makeTrace({transactions: []}), traceOptions);

        // Remove trace node to test empty children scenario
        tree.root.children = [];

        expect(tree.shape).toBe(TraceShape.EMPTY_TRACE);
      });

      it('correctly counts JavaScript SDK events in regular traces', () => {
        const javascriptSdkNames = [
          'sentry.javascript.browser',
          'sentry.javascript.node',
          'sentry.javascript.react',
          'sentry.javascript.vue',
          'sentry.javascript.angular',
          'sentry.javascript.svelte',
          'sentry.javascript.nextjs',
          'sentry.javascript.remix',
        ];

        javascriptSdkNames.forEach(sdkName => {
          const tree = TraceTree.FromTrace(
            makeTrace({
              transactions: [
                makeTransaction({
                  parent_span_id: null,
                  sdk_name: sdkName,
                  children: [],
                }),
                makeTransaction({
                  parent_span_id: null,
                  sdk_name: 'sentry.python',
                  children: [],
                }),
              ],
              orphan_errors: [],
            }),
            traceOptions
          );

          expect(tree.shape).toBe(TraceShape.BROWSER_MULTIPLE_ROOTS);
        });
      });
    });
  });
});
