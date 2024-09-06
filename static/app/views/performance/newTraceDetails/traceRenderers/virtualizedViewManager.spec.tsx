import {OrganizationFixture} from 'sentry-fixture/organization';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {EntryType, type Event} from 'sentry/types/event';
import type {TraceSplitResults} from 'sentry/utils/performance/quickTrace/types';
import {TraceScheduler} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceScheduler';
import {TraceView} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceView';
import {
  type VirtualizedList,
  VirtualizedViewManager,
} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

import {TraceTree} from '../traceModels/traceTree';

function makeEvent(overrides: Partial<Event> = {}, spans: RawSpanType[] = []): Event {
  return {
    entries: [{type: EntryType.SPANS, data: spans}],
    ...overrides,
  } as Event;
}

function makeTrace(
  overrides: Partial<TraceSplitResults<TraceTree.Transaction>>
): TraceSplitResults<TraceTree.Transaction> {
  return {
    transactions: [],
    orphan_errors: [],
    ...overrides,
  } as TraceSplitResults<TraceTree.Transaction>;
}

function makeTransaction(
  overrides: Partial<TraceTree.Transaction> = {}
): TraceTree.Transaction {
  return {
    children: [],
    start_timestamp: 0,
    timestamp: 1,
    transaction: 'transaction',
    'transaction.op': '',
    'transaction.status': '',
    errors: [],
    performance_issues: [],
    ...overrides,
  } as TraceTree.Transaction;
}

function makeSpan(overrides: Partial<RawSpanType> = {}): RawSpanType {
  return {
    op: '',
    description: '',
    span_id: '',
    start_timestamp: 0,
    timestamp: 10,
    ...overrides,
  } as RawSpanType;
}

function makeParentAutogroupSpans(): RawSpanType[] {
  return [
    makeSpan({description: 'span', op: 'db', span_id: 'head_span'}),
    makeSpan({
      description: 'span',
      op: 'db',
      span_id: 'middle_span',
      parent_span_id: 'head_span',
    }),
    makeSpan({
      description: 'span',
      op: 'db',
      span_id: 'tail_span',
      parent_span_id: 'middle_span',
    }),
  ];
}

function makeSiblingAutogroupedSpans(): RawSpanType[] {
  return [
    makeSpan({description: 'span', op: 'db', span_id: 'first_span'}),
    makeSpan({description: 'span', op: 'db', span_id: 'middle_span'}),
    makeSpan({description: 'span', op: 'db', span_id: 'other_middle_span'}),
    makeSpan({description: 'span', op: 'db', span_id: 'another_middle_span'}),
    makeSpan({description: 'span', op: 'db', span_id: 'last_span'}),
  ];
}

function makeSingleTransactionTree(): TraceTree {
  return TraceTree.FromTrace(
    makeTrace({
      transactions: [
        makeTransaction({
          transaction: 'transaction',
          project_slug: 'project',
          event_id: 'event_id',
        }),
      ],
    }),
    null,
    null
  );
}

function makeList(): VirtualizedList {
  return {
    scrollToRow: jest.fn(),
  } as unknown as VirtualizedList;
}

const EVENT_REQUEST_URL =
  '/organizations/org-slug/events/project:event_id/?averageColumn=span.self_time&averageColumn=span.duration';

describe('VirtualizedViewManger', () => {
  it('initializes space', () => {
    const manager = new VirtualizedViewManager(
      {
        list: {width: 0.5},
        span_list: {width: 0.5},
      },
      new TraceScheduler(),
      new TraceView()
    );

    manager.view.setTraceSpace([10_000, 0, 1000, 1]);

    expect(manager.view.trace_space.serialize()).toEqual([0, 0, 1000, 1]);
    expect(manager.view.trace_view.serialize()).toEqual([0, 0, 1000, 1]);
  });

  it('initializes physical space', () => {
    const manager = new VirtualizedViewManager(
      {
        list: {width: 0.5},
        span_list: {width: 0.5},
      },
      new TraceScheduler(),
      new TraceView()
    );

    manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 500, 1]);

    expect(manager.view.trace_container_physical_space.serialize()).toEqual([
      0, 0, 1000, 1,
    ]);
    expect(manager.view.trace_physical_space.serialize()).toEqual([0, 0, 500, 1]);
  });

  describe('computeSpanCSSMatrixTransform', () => {
    it('enforces min scaling', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([0, 0, 1000, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

      expect(manager.computeSpanCSSMatrixTransform([0, 0.1])).toEqual([
        0.001, 0, 0, 1, 0, 0,
      ]);
    });
    it('computes width scaling correctly', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([0, 0, 100, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

      expect(manager.computeSpanCSSMatrixTransform([0, 100])).toEqual([1, 0, 0, 1, 0, 0]);
    });

    it('computes x position correctly', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([0, 0, 1000, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

      expect(manager.computeSpanCSSMatrixTransform([50, 1000])).toEqual([
        1, 0, 0, 1, 50, 0,
      ]);
    });

    it('computes span x position correctly', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([0, 0, 1000, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

      expect(manager.computeSpanCSSMatrixTransform([50, 1000])).toEqual([
        1, 0, 0, 1, 50, 0,
      ]);
    });

    describe('when start is not 0', () => {
      it('computes width scaling correctly', () => {
        const manager = new VirtualizedViewManager(
          {
            list: {width: 0},
            span_list: {width: 1},
          },
          new TraceScheduler(),
          new TraceView()
        );

        manager.view.setTraceSpace([100, 0, 100, 1]);
        manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

        expect(manager.computeSpanCSSMatrixTransform([100, 100])).toEqual([
          1, 0, 0, 1, 0, 0,
        ]);
      });
      it('computes x position correctly when view is offset', () => {
        const manager = new VirtualizedViewManager(
          {
            list: {width: 0},
            span_list: {width: 1},
          },
          new TraceScheduler(),
          new TraceView()
        );

        manager.view.setTraceSpace([100, 0, 100, 1]);
        manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

        expect(manager.computeSpanCSSMatrixTransform([100, 100])).toEqual([
          1, 0, 0, 1, 0, 0,
        ]);
      });
    });
  });

  describe('transformXFromTimestamp', () => {
    it('computes x position correctly', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([0, 0, 1000, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

      expect(manager.transformXFromTimestamp(50)).toEqual(50);
    });

    it('computes x position correctly when view is offset', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([50, 0, 1000, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

      manager.view.trace_view.x = 50;

      expect(manager.transformXFromTimestamp(-50)).toEqual(-150);
    });

    it('when view is offset and scaled', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([100, 0, 1000, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);
      manager.view.setTraceView({width: 500, x: 500});

      expect(Math.round(manager.transformXFromTimestamp(100))).toEqual(-500);
    });
  });

  describe('expandToPath', () => {
    const organization = OrganizationFixture();
    const api = new MockApiClient();

    const manager = new VirtualizedViewManager(
      {
        list: {width: 0.5},
        span_list: {width: 0.5},
      },
      new TraceScheduler(),
      new TraceView()
    );

    it('scrolls to root node', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [makeTransaction()],
          orphan_errors: [],
        }),
        null,
        null
      );

      manager.list = makeList();

      const result = await TraceTree.ExpandToPath(tree, tree.list[0].path, () => void 0, {
        api: api,
        organization,
      });

      expect(result?.node).toBe(tree.list[0]);
    });

    it('scrolls to transaction', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction(),
            makeTransaction({
              event_id: 'event_id',
              children: [],
            }),
          ],
        }),
        null,
        null
      );

      manager.list = makeList();

      const result = await TraceTree.ExpandToPath(tree, ['txn-event_id'], () => void 0, {
        api: api,
        organization,
      });

      expect(result?.node).toBe(tree.list[2]);
    });

    it('scrolls to nested transaction', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              event_id: 'root',
              children: [
                makeTransaction({
                  event_id: 'child',
                  children: [
                    makeTransaction({
                      event_id: 'event_id',
                      children: [],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        null,
        null
      );

      manager.list = makeList();

      expect(tree.list[tree.list.length - 1].path).toEqual([
        'txn-event_id',
        'txn-child',
        'txn-root',
      ]);
      const result = await TraceTree.ExpandToPath(
        tree,
        ['txn-event_id', 'txn-child', 'txn-root'],
        () => void 0,
        {
          api: api,
          organization,
        }
      );

      expect(result?.node).toBe(tree.list[tree.list.length - 1]);
    });

    it('scrolls to spans of expanded transaction', async () => {
      manager.list = makeList();

      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              event_id: 'event_id',
              project_slug: 'project',
              children: [],
            }),
          ],
        }),
        null,
        null
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEvent(undefined, [makeSpan({span_id: 'span_id'})]),
      });

      const result = await TraceTree.ExpandToPath(
        tree,
        ['span-span_id', 'txn-event_id'],
        () => void 0,
        {
          api: api,
          organization,
        }
      );

      expect(tree.list[1].zoomedIn).toBe(true);
      expect(result?.node).toBe(tree.list[2]);
    });

    it('scrolls to span -> transaction -> span -> transaction', async () => {
      manager.list = makeList();

      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              event_id: 'event_id',
              project_slug: 'project_slug',
              children: [
                makeTransaction({
                  parent_span_id: 'child_span',
                  event_id: 'child_event_id',
                  project_slug: 'project_slug',
                }),
              ],
            }),
          ],
        }),
        null,
        null
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEvent(undefined, [
          makeSpan({span_id: 'other_child_span'}),
          makeSpan({span_id: 'child_span'}),
        ]),
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/project_slug:child_event_id/?averageColumn=span.self_time&averageColumn=span.duration',
        method: 'GET',
        body: makeEvent(undefined, [makeSpan({span_id: 'other_child_span'})]),
      });

      const result = await TraceTree.ExpandToPath(
        tree,
        ['span-other_child_span', 'txn-child_event_id', 'txn-event_id'],
        () => void 0,
        {
          api: api,
          organization,
        }
      );

      expect(result).toBeTruthy();
    });

    describe('scrolls to directly autogrouped node', () => {
      for (const headOrTailId of ['head_span', 'tail_span']) {
        it('scrolls to directly autogrouped node head', async () => {
          manager.list = makeList();
          const tree = makeSingleTransactionTree();

          MockApiClient.addMockResponse({
            url: EVENT_REQUEST_URL,
            method: 'GET',
            body: makeEvent({}, makeParentAutogroupSpans()),
          });

          const result = await TraceTree.ExpandToPath(
            tree,
            [`ag-${headOrTailId}`, 'txn-event_id'],
            () => void 0,
            {
              api: api,
              organization,
            }
          );

          expect(result).toBeTruthy();
        });
      }

      for (const headOrTailId of ['head_span', 'tail_span']) {
        it('scrolls to child of autogrouped node head or tail', async () => {
          manager.list = makeList();
          const tree = makeSingleTransactionTree();

          MockApiClient.addMockResponse({
            url: EVENT_REQUEST_URL,
            method: 'GET',
            body: makeEvent({}, makeParentAutogroupSpans()),
          });

          const result = await TraceTree.ExpandToPath(
            tree,
            ['span-middle_span', `ag-${headOrTailId}`, 'txn-event_id'],
            () => void 0,
            {
              api: api,
              organization,
            }
          );

          expect(result).toBeTruthy();
        });
      }
    });

    describe('sibling autogrouping', () => {
      it('scrolls to child span of sibling autogrouped node', async () => {
        manager.list = makeList();
        const tree = makeSingleTransactionTree();

        MockApiClient.addMockResponse({
          url: EVENT_REQUEST_URL,
          method: 'GET',
          body: makeEvent({}, makeSiblingAutogroupedSpans()),
        });

        const result = await TraceTree.ExpandToPath(
          tree,
          ['span-middle_span', `ag-first_span`, 'txn-event_id'],
          () => void 0,
          {
            api: api,
            organization,
          }
        );

        expect(result).toBeTruthy();
      });
    });

    describe('missing instrumentation', () => {
      it('scrolls to missing instrumentation via previous span_id', async () => {
        manager.list = makeList();
        const tree = makeSingleTransactionTree();

        MockApiClient.addMockResponse({
          url: EVENT_REQUEST_URL,
          method: 'GET',
          body: makeEvent({}, [
            makeSpan({
              description: 'span',
              op: 'db',
              start_timestamp: 0,
              timestamp: 0.5,
              span_id: 'first_span',
            }),
            makeSpan({
              description: 'span',
              op: 'db',
              start_timestamp: 0.7,
              timestamp: 1,
              span_id: 'middle_span',
            }),
          ]),
        });

        const result = await TraceTree.ExpandToPath(
          tree,
          ['ms-first_span', 'txn-event_id'],
          () => void 0,
          {
            api: api,
            organization,
          }
        );

        expect(result).toBeTruthy();
      });
      it('scrolls to missing instrumentation via next span_id', async () => {
        manager.list = makeList();
        const tree = makeSingleTransactionTree();

        MockApiClient.addMockResponse({
          url: EVENT_REQUEST_URL,
          method: 'GET',
          body: makeEvent({}, [
            makeSpan({
              description: 'span',
              op: 'db',
              start_timestamp: 0,
              timestamp: 0.5,
              span_id: 'first_span',
            }),
            makeSpan({
              description: 'span',
              op: 'db',
              start_timestamp: 0.7,
              timestamp: 1,
              span_id: 'second_span',
            }),
          ]),
        });

        const result = await TraceTree.ExpandToPath(
          tree,
          ['ms-second_span', 'txn-event_id'],
          () => void 0,
          {
            api: api,
            organization,
          }
        );

        expect(result).toBeTruthy();
      });
    });

    it('scrolls to orphan error', async () => {
      manager.list = makeList();
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [makeTransaction()],
          orphan_errors: [
            {
              event_id: 'ded',
              project_slug: 'project_slug',
              project_id: 1,
              issue: 'whoa rusty',
              issue_id: 0,
              span: '',
              level: 'error',
              title: 'ded fo good',
              message: 'ded fo good',
              timestamp: 1,
            },
          ],
        }),
        null,
        null
      );

      const result = await TraceTree.ExpandToPath(tree, ['error-ded'], () => void 0, {
        api: api,
        organization,
      });

      expect(result?.node).toBe(tree.list[2]);
    });

    describe('error handling', () => {
      it('scrolls to child span of sibling autogrouped node when path is missing autogrouped node', async () => {
        manager.list = makeList();
        const tree = makeSingleTransactionTree();

        MockApiClient.addMockResponse({
          url: EVENT_REQUEST_URL,
          method: 'GET',
          body: makeEvent({}, makeSiblingAutogroupedSpans()),
        });

        const result = await TraceTree.ExpandToPath(
          tree,
          ['span-middle_span', 'txn-event_id'],
          () => void 0,
          {
            api: api,
            organization,
          }
        );

        expect(result).toBeTruthy();
      });

      it('scrolls to child span of parent autogrouped node when path is missing autogrouped node', async () => {
        manager.list = makeList();
        const tree = makeSingleTransactionTree();

        MockApiClient.addMockResponse({
          url: EVENT_REQUEST_URL,
          method: 'GET',
          body: makeEvent({}, makeParentAutogroupSpans()),
        });

        const result = await TraceTree.ExpandToPath(
          tree,
          ['span-middle_span', 'txn-event_id'],
          () => void 0,
          {
            api: api,
            organization,
          }
        );

        expect(result).toBeTruthy();
      });
    });
  });
});
