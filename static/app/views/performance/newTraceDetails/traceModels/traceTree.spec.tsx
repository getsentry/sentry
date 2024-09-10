import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {EntryType, type Event, type EventTransaction} from 'sentry/types/event';
import type {
  TracePerformanceIssue,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import * as useOrganization from 'sentry/utils/useOrganization';

import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from '../guards';
import {TraceType} from '../traceType';

import {
  ParentAutogroupNode,
  SiblingAutogroupNode,
  TraceTree,
  TraceTreeNode,
} from './traceTree';

const EVENT_REQUEST_URL =
  '/organizations/org-slug/events/project:event_id/?averageColumn=span.self_time&averageColumn=span.duration';

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
    sdk_name: '',
    start_timestamp: 0,
    timestamp: 1,
    transaction: 'transaction',
    'transaction.op': '',
    'transaction.status': '',
    performance_issues: [],
    errors: [],
    ...overrides,
  } as TraceTree.Transaction;
}

function makeSpan(overrides: Partial<RawSpanType> = {}): TraceTree.Span {
  return {
    span_id: '',
    op: '',
    description: '',
    start_timestamp: 0,
    timestamp: 10,
    data: {},
    trace_id: '',
    childTransactions: [],
    event: makeEvent() as EventTransaction,
    ...overrides,
  };
}

function makeTraceError(
  overrides: Partial<TraceTree.TraceError> = {}
): TraceTree.TraceError {
  return {
    title: 'MaybeEncodingError: Error sending result',
    level: 'error',
    event_type: 'error',
    data: {},
    ...overrides,
  } as TraceTree.TraceError;
}

function makeTracePerformanceIssue(
  overrides: Partial<TracePerformanceIssue> = {}
): TracePerformanceIssue {
  return {
    culprit: 'code',
    end: new Date().toISOString(),
    span: [],
    start: new Date().toISOString(),
    suspect_spans: ['sus span'],
    type: 0,
    issue_short_id: 'issue short id',
    ...overrides,
  } as TracePerformanceIssue;
}

function makeEvent(overrides: Partial<Event> = {}, spans: RawSpanType[] = []): Event {
  return {
    entries: [{type: EntryType.SPANS, data: spans}],
    ...overrides,
  } as Event;
}

function assertSpanNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): asserts node is TraceTreeNode<TraceTree.Span> {
  if (!isSpanNode(node)) {
    throw new Error('node is not a span');
  }
}

// function assertTraceNode(
//   node: TraceTreeNode<TraceTree.NodeValue>
// ): asserts node is TraceTreeNode<TraceTree.Trace> {
//   if (!isTraceNode(node)) {
//     throw new Error('node is not a trace');
//   }
// }

function assertTransactionNode(
  node: TraceTreeNode<TraceTree.NodeValue> | null
): asserts node is TraceTreeNode<TraceTree.Transaction> {
  if (!node || !isTransactionNode(node)) {
    throw new Error('node is not a transaction');
  }
}

function assertMissingInstrumentationNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): asserts node is TraceTreeNode<TraceTree.MissingInstrumentationSpan> {
  if (!isMissingInstrumentationNode(node)) {
    throw new Error('node is not a missing instrumentation node');
  }
}

function assertTraceErrorNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): asserts node is TraceTreeNode<TraceTree.TraceError> {
  if (!isTraceErrorNode(node)) {
    throw new Error('node is not a trace error node');
  }
}

function assertAutogroupedNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): asserts node is ParentAutogroupNode | SiblingAutogroupNode {
  if (!isAutogroupedNode(node)) {
    throw new Error('node is not a autogrouped node');
  }
}

function assertParentAutogroupedNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): asserts node is ParentAutogroupNode {
  if (!(node instanceof ParentAutogroupNode)) {
    throw new Error('node is not a parent autogrouped node');
  }
}

function assertSiblingAutogroupedNode(
  node: TraceTreeNode<TraceTree.NodeValue>
): asserts node is ParentAutogroupNode {
  if (!(node instanceof SiblingAutogroupNode)) {
    throw new Error('node is not a parent node');
  }
}

describe('TreeNode', () => {
  it('expands transaction nodes by default', () => {
    const node = new TraceTreeNode(null, makeTransaction(), {
      project_slug: '',
      event_id: '',
    });
    expect(node.expanded).toBe(true);
  });
  it('points parent to node', () => {
    const root = new TraceTreeNode(null, makeTransaction(), {
      project_slug: '',
      event_id: '',
    });
    const child = new TraceTreeNode(root, makeTransaction(), {
      project_slug: '',
      event_id: '',
    });
    expect(child.parent).toBe(root);
  });
  it('depth', () => {
    const root = new TraceTreeNode(null, makeTransaction(), {
      project_slug: '',
      event_id: '',
    });
    const child = new TraceTreeNode(root, makeTransaction(), {
      project_slug: '',
      event_id: '',
    });
    const grandChild = new TraceTreeNode(child, makeTransaction(), {
      project_slug: '',
      event_id: '',
    });
    expect(grandChild.depth).toBe(1);
  });
  it('getVisibleChildren', () => {
    const root = new TraceTreeNode(null, makeTransaction(), {
      project_slug: '',
      event_id: '',
    });

    const child = new TraceTreeNode(root, makeTransaction(), {
      project_slug: '',
      event_id: '',
    });

    root.children.push(child);
    expect(root.getVisibleChildren()).toHaveLength(1);
    expect(root.getVisibleChildren()[0]).toBe(child);

    root.expanded = false;
    expect(root.getVisibleChildren()).toHaveLength(0);
  });

  it('getVisibleChildrenCount', () => {
    const root = new TraceTreeNode(null, makeTransaction(), {
      project_slug: '',
      event_id: '',
    });

    const child = new TraceTreeNode(root, makeTransaction(), {
      project_slug: '',
      event_id: '',
    });

    root.children.push(child);
    expect(root.getVisibleChildrenCount()).toBe(1);

    root.expanded = false;
    expect(root.getVisibleChildrenCount()).toBe(0);
  });

  describe('indicators', () => {
    it('collects indicator', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: 0,
              timestamp: 1,
              measurements: {ttfb: {value: 0, unit: 'millisecond'}},
            }),
          ],
        }),
        null,
        null
      );

      expect(tree.indicators.length).toBe(1);
      expect(tree.indicators[0].start).toBe(0);
    });

    it('converts timestamp to milliseconds', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: 0,
              timestamp: 1,
              measurements: {
                ttfb: {value: 500, unit: 'millisecond'},
                fcp: {value: 0.5, unit: 'second'},
                lcp: {value: 500_000_000, unit: 'nanosecond'},
              },
            }),
          ],
        }),
        null,
        null
      );

      expect(tree.indicators[0].start).toBe(500);
      expect(tree.indicators[1].start).toBe(500);
      expect(tree.indicators[2].start).toBe(500);
    });

    it('extends end timestamp to include measurement', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: 0,
              timestamp: 1,
              measurements: {
                ttfb: {value: 2, unit: 'second'},
              },
            }),
          ],
        }),
        null,
        null
      );

      expect(tree.root.space).toEqual([0, 2000]);
    });

    it('adjusts end and converst timestamp to ms', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: 0,
              timestamp: 1,
              measurements: {
                ttfb: {value: 2000, unit: 'millisecond'},
              },
            }),
          ],
        }),
        null,
        null
      );

      expect(tree.root.space).toEqual([0, 2000]);
      expect(tree.indicators[0].start).toBe(2000);
    });

    it('sorts measurements by start', () => {
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
        null,
        null
      );

      expect(tree.indicators[0].start).toBe(1000);
      expect(tree.indicators[1].start).toBe(2000);
    });
  });

  describe('parent autogrouped node segments', () => {
    it('collapses durations', () => {
      const root = new TraceTreeNode(null, makeSpan({description: 'span1'}), {
        project_slug: '',
        event_id: '',
      });

      let parent = root;
      for (let i = 0; i < 5; i++) {
        const node = new TraceTreeNode(
          parent,
          makeSpan({
            description: 'span',
            op: 'db',
            start_timestamp: i,
            timestamp: i + 1,
            span_id: i.toString(),
            parent_span_id: parent.value.span_id,
          }),
          {
            project_slug: '',
            event_id: '',
          }
        );
        parent.children.push(node);
        parent = node;
      }

      TraceTree.AutogroupDirectChildrenSpanNodes(root);

      const autogroupedNode = root.children[0];
      assertParentAutogroupedNode(autogroupedNode);
      expect(autogroupedNode.autogroupedSegments).toEqual([[0, 5000]]);
    });

    it('does not collapse durations when there is a gap', () => {
      const root = new TraceTreeNode(null, makeSpan({description: 'span1'}), {
        project_slug: '',
        event_id: '',
      });

      let parent = root;

      const ts = [
        [0, 1],
        [1.5, 2],
        [2.5, 3],
        [3.5, 4],
        [4.5, 5],
      ];

      for (let i = 0; i < 5; i++) {
        const node = new TraceTreeNode(
          parent,
          makeSpan({
            description: 'span',
            op: 'db',
            start_timestamp: ts[i][0],
            timestamp: ts[i][1],
            span_id: i.toString(),
            parent_span_id: parent.value.span_id,
          }),
          {
            project_slug: '',
            event_id: '',
          }
        );
        parent.children.push(node);
        parent = node;
      }

      for (let i = 1; i < ts.length; i++) {
        ts[i][0] *= 1000;
        ts[i][1] = 0.5 * 1000;
      }

      ts[0][0] = 0;
      ts[0][1] = 1 * 1000;

      TraceTree.AutogroupDirectChildrenSpanNodes(root);

      const autogroupedNode = root.children[0];
      assertParentAutogroupedNode(autogroupedNode);
      expect(autogroupedNode.autogroupedSegments).toEqual(ts);
    });
  });

  describe('sibling autogrouped node segments', () => {
    it('collapses durations', () => {
      const root = new TraceTreeNode(null, makeSpan({description: 'span1'}), {
        project_slug: '',
        event_id: '',
      });

      for (let i = 0; i < 5; i++) {
        root.children.push(
          new TraceTreeNode(
            root,
            makeSpan({
              description: 'span',
              op: 'db',
              start_timestamp: i,
              timestamp: i + 1,
            }),
            {
              project_slug: '',
              event_id: '',
            }
          )
        );
      }

      TraceTree.AutogroupSiblingSpanNodes(root);
      const autogroupedNode = root.children[0];

      assertAutogroupedNode(autogroupedNode);
      expect(autogroupedNode.autogroupedSegments).toEqual([[0, 5000]]);
    });

    it('does not collapse durations when there is a gap', () => {
      const root = new TraceTreeNode(null, makeSpan({description: 'span1'}), {
        project_slug: '',
        event_id: '',
      });

      const ts = [
        [0, 1],
        [1.5, 2],
        [2.5, 3],
        [3.5, 4],
        [4.5, 5],
      ];

      for (let i = 0; i < 5; i++) {
        root.children.push(
          new TraceTreeNode(
            root,
            makeSpan({
              description: 'span',
              op: 'db',
              start_timestamp: ts[i][0],
              timestamp: ts[i][1],
            }),
            {
              project_slug: '',
              event_id: '',
            }
          )
        );
      }

      for (let i = 0; i < ts.length; i++) {
        ts[i][0] *= 1000;
        ts[i][1] = 0.5 * 1000;
      }

      ts[0][0] = 0;
      ts[0][1] = 1 * 1000;

      TraceTree.AutogroupSiblingSpanNodes(root);
      const autogroupedNode = root.children[0];

      assertAutogroupedNode(autogroupedNode);
      expect(autogroupedNode.autogroupedSegments).toEqual(ts);
    });
  });

  describe('path', () => {
    describe('nested transactions', () => {
      let child: any = null;
      for (let i = 0; i < 3; i++) {
        const node = new TraceTreeNode(
          child,
          makeTransaction({
            event_id: i === 0 ? 'parent' : i === 1 ? 'child' : 'grandchild',
          }),
          {
            project_slug: '',
            event_id: '',
          }
        );

        child = node;
      }

      it('first txn node', () => {
        expect(child.parent.parent.path).toEqual(['txn-parent']);
      });
      it('leafmost node', () => {
        expect(child.path).toEqual(['txn-grandchild', 'txn-child', 'txn-parent']);
      });
    });

    it('orphan errors', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [],
          orphan_errors: [makeTraceError({event_id: 'error_id'})],
        }),
        null,
        null
      );

      expect(tree.list[1].path).toEqual(['error-error_id']);
    });

    describe('spans', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: '/',
              project_slug: 'project',
              event_id: 'event_id',
            }),
          ],
        }),
        null,
        null
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEvent({}, [
          makeSpan({
            description: 'span',
            op: 'db',
            span_id: 'span',
            start_timestamp: 0,
            timestamp: 1,
          }),
          makeSpan({
            description: 'span',
            op: 'db',
            span_id: 'span',
            start_timestamp: 1.5,
            timestamp: 2,
          }),
        ]),
      });

      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      it('when span is a child of a txn', async () => {
        await waitFor(() => {
          expect(tree.list.length).toBe(5);
        });

        expect(tree.list[tree.list.length - 1].path).toEqual([
          'span-span',
          'txn-event_id',
        ]);
      });

      it('missing instrumentation', () => {
        expect(tree.list[3].path).toEqual(['ms-span', 'txn-event_id']);
      });
    });

    it('adjusts trace space when spans exceed the bounds of a trace', () => {
      const adjusted = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: 1,
              timestamp: 3,
            }),
          ],
          orphan_errors: [],
        }),
        null,
        null
      );

      expect(adjusted.root.space).toEqual([1000, 2000]);

      const [_, adjusted_space] = TraceTree.FromSpans(
        adjusted.root,
        makeEvent(),
        [makeSpan({start_timestamp: 0.5, timestamp: 3.5})],
        {sdk: undefined}
      );

      expect(adjusted_space).toEqual([0.5, 3.5]);
    });

    describe('autogrouped children', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: '/',
              project_slug: 'project',
              event_id: 'event_id',
            }),
          ],
        }),
        null,
        null
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEvent({}, [
          makeSpan({description: 'span', op: 'db', span_id: '2'}),
          makeSpan({description: 'span', op: 'db', span_id: '3', parent_span_id: '2'}),
          makeSpan({description: 'span', op: 'db', span_id: '4', parent_span_id: '3'}),
          makeSpan({description: 'span', op: 'db', span_id: '5', parent_span_id: '4'}),
        ]),
      });

      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      it('autogrouped node', async () => {
        await waitFor(() => {
          expect(tree.list.length).toBe(3);
        });
        tree.expand(tree.list[2], true);
        assertAutogroupedNode(tree.list[2]);
        expect(tree.list[2].path).toEqual(['ag-2', 'txn-event_id']);
      });

      it('child is part of autogrouping', () => {
        expect(tree.list[tree.list.length - 1].path).toEqual([
          'span-5',
          'ag-2',
          'txn-event_id',
        ]);
      });
    });

    describe('collapses some node by default', () => {
      it('android okhttp', async () => {
        const tree = TraceTree.FromTrace(
          makeTrace({
            transactions: [
              makeTransaction({
                transaction: '/',
                project_slug: 'project',
                event_id: 'event_id',
              }),
            ],
          }),
          null,
          null
        );

        MockApiClient.addMockResponse({
          url: EVENT_REQUEST_URL,
          method: 'GET',
          body: makeEvent({}, [
            makeSpan({
              description: 'span',
              span_id: '2',
              op: 'http.client',
              origin: 'auto.http.okhttp',
            }),
            makeSpan({
              description: 'span',
              op: 'http.client.tls',
              span_id: '3',
              parent_span_id: '2',
            }),
          ]),
        });

        tree.zoomIn(tree.list[1], true, {
          api: new MockApiClient(),
          organization: OrganizationFixture(),
        });

        await waitFor(() => {
          // trace
          //  - transaction
          //   - http.client
          //    ^ child of http.client is not visible
          expect(tree.list.length).toBe(3);
        });
      });
    });

    describe('non expanded direct children autogrouped path', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: '/',
              project_slug: 'project',
              event_id: 'event_id',
            }),
          ],
        }),
        null,
        null
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEvent({}, [
          makeSpan({description: 'span', op: 'db', span_id: '2'}),
          makeSpan({description: 'span', op: 'db', span_id: '3', parent_span_id: '2'}),
          makeSpan({description: 'span', op: 'db', span_id: '4', parent_span_id: '3'}),
          makeSpan({description: 'span', op: 'db', span_id: '5', parent_span_id: '4'}),
          makeSpan({description: 'span', op: '6', span_id: '6', parent_span_id: '5'}),
        ]),
      });

      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      it('autogrouped node', async () => {
        await waitFor(() => {
          expect(tree.list.length).toBe(4);
        });
        assertAutogroupedNode(tree.list[2]);
        expect(tree.list[2].path).toEqual(['ag-2', 'txn-event_id']);
      });
      it('span node skips autogrouped node because it is not expanded', async () => {
        await waitFor(() => {
          expect(tree.list.length).toBe(4);
        });
        expect(tree.list[tree.list.length - 1].path).toEqual(['span-6', 'txn-event_id']);
      });
    });
  });
});

describe('TraceTree', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });
  it('builds from transactions', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            children: [],
          }),
          makeTransaction({
            children: [],
          }),
        ],
      }),
      null,
      null
    );

    expect(tree.list).toHaveLength(3);
  });

  it('builds orphan errors', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            children: [],
          }),
          makeTransaction({
            children: [],
          }),
        ],
        orphan_errors: [makeTraceError()],
      }),
      null,
      null
    );

    expect(tree.list).toHaveLength(4);
  });

  it('processes orphan errors without timestamps', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            children: [],
          }),
        ],
        orphan_errors: [
          {
            level: 'error',
            title: 'Error',
            event_type: 'error',
          } as TraceTree.TraceError,
        ],
      }),
      null,
      null
    );

    expect(tree.list).toHaveLength(3);
  });

  it('sorts orphan errors', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            start_timestamp: 0,
            timestamp: 1,
          }),
          makeTransaction({
            start_timestamp: 2,
            timestamp: 3,
          }),
        ],
        orphan_errors: [makeTraceError({timestamp: 1, level: 'error'})],
      }),
      null,
      null
    );

    expect(tree.list).toHaveLength(4);
    assertTraceErrorNode(tree.list[2]);
  });

  it('adjusts trace bounds by orphan error timestamp as well', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            start_timestamp: 0.1,
            timestamp: 0.15,
            children: [],
          }),
          makeTransaction({
            start_timestamp: 0.2,
            timestamp: 0.25,
            children: [],
          }),
        ],
        orphan_errors: [
          makeTraceError({timestamp: 0.05}),
          makeTraceError({timestamp: 0.3}),
        ],
      }),
      null,
      null
    );

    expect(tree.list).toHaveLength(5);
    expect(tree.root.space).toStrictEqual([
      0.05 * tree.root.multiplier,
      (0.3 - 0.05) * tree.root.multiplier,
    ]);
  });

  it('calculates correct trace type', () => {
    let tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [],
        orphan_errors: [],
      }),
      null,
      null
    );

    expect(tree.shape).toBe(TraceType.EMPTY_TRACE);

    tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            children: [],
          }),
          makeTransaction({
            children: [],
          }),
        ],
        orphan_errors: [],
      }),
      null,
      null
    );

    expect(tree.shape).toBe(TraceType.NO_ROOT);

    tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            parent_span_id: null,
            children: [],
          }),
        ],
        orphan_errors: [],
      }),
      null,
      null
    );

    expect(tree.shape).toBe(TraceType.ONE_ROOT);

    tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            parent_span_id: null,
            children: [],
          }),
          makeTransaction({
            children: [],
          }),
        ],
        orphan_errors: [],
      }),
      null,
      null
    );

    expect(tree.shape).toBe(TraceType.BROKEN_SUBTRACES);

    tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            parent_span_id: null,
            children: [],
          }),
          makeTransaction({
            parent_span_id: null,
            children: [],
          }),
        ],
        orphan_errors: [],
      }),
      null,
      null
    );

    expect(tree.shape).toBe(TraceType.MULTIPLE_ROOTS);

    tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [],
        orphan_errors: [makeTraceError()],
      }),
      null,
      null
    );

    expect(tree.shape).toBe(TraceType.ONLY_ERRORS);
  });

  it('browser multiple roots shape', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({sdk_name: 'javascript', parent_span_id: null}),
          makeTransaction({sdk_name: 'javascript', parent_span_id: null}),
        ],
        orphan_errors: [],
      }),
      null,
      null
    );

    expect(tree.shape).toBe(TraceType.BROWSER_MULTIPLE_ROOTS);
  });

  it('builds from spans when root is a transaction node', () => {
    const root = new TraceTreeNode(
      null,
      makeTransaction({
        children: [],
      }),
      {project_slug: '', event_id: ''}
    );

    const [node] = TraceTree.FromSpans(
      root,
      makeEvent(),
      [
        makeSpan({start_timestamp: 0, op: '1', span_id: '1'}),
        makeSpan({start_timestamp: 1, op: '2', span_id: '2', parent_span_id: '1'}),
        makeSpan({start_timestamp: 2, op: '3', span_id: '3', parent_span_id: '2'}),
        makeSpan({start_timestamp: 3, op: '4', span_id: '4', parent_span_id: '1'}),
      ],
      {sdk: undefined}
    );

    if (!isSpanNode(node.children[0])) {
      throw new Error('Child needs to be a span');
    }
    expect(node.children[0].value.span_id).toBe('1');
    expect(node.children[0].value.start_timestamp).toBe(0);
    expect(node.children.length).toBe(1);

    assertSpanNode(node.children[0].children[0]);
    assertSpanNode(node.children[0].children[0].children[0]);
    assertSpanNode(node.children[0].children[1]);

    expect(node.children[0].children[0].value.start_timestamp).toBe(1);
    expect(node.children[0].children[0].children[0].value.start_timestamp).toBe(2);
    expect(node.children[0].children[1].value.start_timestamp).toBe(3);
  });

  it('builds from spans and copies txn nodes', () => {
    // transaction                transaction
    //  - child transaction  ->    - span
    //                             - span
    //                               - child-transaction
    //                             - span
    const root = new TraceTreeNode(
      null,
      makeTransaction({
        children: [],
      }),
      {project_slug: '', event_id: ''}
    );

    root.children.push(
      new TraceTreeNode(
        root,
        makeTransaction({
          parent_span_id: 'child-transaction',
        }),
        {project_slug: '', event_id: ''}
      )
    );

    const [node] = TraceTree.FromSpans(
      root,
      makeEvent(),
      [
        makeSpan({start_timestamp: 0, timestamp: 0.1, op: 'span', span_id: 'none'}),
        makeSpan({
          start_timestamp: 0.1,
          timestamp: 0.2,
          op: 'child-transaction',
          span_id: 'child-transaction',
        }),
        makeSpan({start_timestamp: 0.2, timestamp: 0.25, op: 'span', span_id: 'none'}),
      ],
      {sdk: undefined}
    );

    assertSpanNode(node.children[1]);
    assertTransactionNode(node.children[1].children[0]);
  });

  it('builds from spans and copies txn nodes to nested children', () => {
    // parent transaction             parent transaction
    //  - child transaction  ->        - span
    //   - grandchild transaction  ->  - child-transaction
    //                                  - grandchild-transaction
    //
    const root = new TraceTreeNode(
      null,
      makeTransaction({
        span_id: 'parent-transaction',
        children: [],
      }),
      {project_slug: '', event_id: ''}
    );

    let start: TraceTreeNode<TraceTree.NodeValue> = root;
    for (let i = 0; i < 2; i++) {
      const node = new TraceTreeNode(
        start,
        makeTransaction({
          transaction: `${i === 0 ? 'child' : 'grandchild'}-transaction`,
          parent_span_id: `${i === 0 ? 'child' : 'grandchild'}-transaction`,
        }),
        {project_slug: '', event_id: ''}
      );

      start.children.push(node);
      start = node;
    }

    const [node] = TraceTree.FromSpans(
      root,
      makeEvent(),
      [
        makeSpan({start_timestamp: 0, timestamp: 0.1, op: 'span', span_id: 'none'}),
        makeSpan({
          start_timestamp: 0.1,
          timestamp: 0.2,
          op: 'child-transaction',
          span_id: 'child-transaction',
        }),
      ],
      {sdk: undefined}
    );

    assertSpanNode(node.children[1]);
    assertTransactionNode(node.children[1].children[0]);
    assertTransactionNode(node.children[1].children[0].children[0]);
  });

  it('injects missing spans', () => {
    const root = new TraceTreeNode(
      null,
      makeTransaction({
        children: [],
      }),
      {project_slug: '', event_id: ''}
    );

    const date = new Date().getTime();
    const [node] = TraceTree.FromSpans(
      root,
      makeEvent(),
      [
        makeSpan({
          start_timestamp: date,
          timestamp: date + 1,
          span_id: '1',
          op: 'span 1',
        }),
        makeSpan({
          start_timestamp: date + 2,
          timestamp: date + 4,
          op: 'span 2',
          span_id: '2',
        }),
      ],
      {sdk: undefined}
    );

    assertSpanNode(node.children[0]);
    assertMissingInstrumentationNode(node.children[1]);
    assertSpanNode(node.children[2]);

    expect(node.children.length).toBe(3);
    expect(node.children[0].value.op).toBe('span 1');
    expect(node.children[1].value.type).toBe('missing_instrumentation');
    expect(node.children[2].value.op).toBe('span 2');
  });

  it('does not inject missing spans for javascript platform', () => {
    const root = new TraceTreeNode(
      null,
      makeTransaction({
        children: [],
      }),
      {project_slug: '', event_id: ''}
    );

    const date = new Date().getTime();
    const [node] = TraceTree.FromSpans(
      root,
      makeEvent(),
      [
        makeSpan({
          start_timestamp: date,
          timestamp: date + 1,
          span_id: '1',
          op: 'span 1',
        }),
        makeSpan({
          start_timestamp: date + 2,
          timestamp: date + 4,
          op: 'span 2',
          span_id: '2',
        }),
      ],
      {sdk: 'sentry.javascript.browser'}
    );

    assertSpanNode(node.children[0]);
    assertSpanNode(node.children[1]);

    expect(node.children.length).toBe(2);
    expect(node.children[0].value.op).toBe('span 1');
    expect(node.children[1].value.op).toBe('span 2');
  });

  it('builds and preserves list order', async () => {
    const organization = OrganizationFixture();
    const api = new MockApiClient();

    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            transaction: 'txn 1',
            start_timestamp: 0,
            children: [makeTransaction({start_timestamp: 1, transaction: 'txn 2'})],
          }),
        ],
      }),
      null,
      null
    );

    tree.expand(tree.list[0], true);
    const node = tree.list[1];

    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/undefined:undefined/?averageColumn=span.self_time&averageColumn=span.duration',
      method: 'GET',
      body: makeEvent({startTimestamp: 0}, [
        makeSpan({start_timestamp: 1, op: 'span 1', span_id: '1'}),
        makeSpan({
          start_timestamp: 2,
          op: 'span 2',
          span_id: '2',
          parent_span_id: '1',
        }),
        makeSpan({start_timestamp: 3, op: 'span 3', parent_span_id: '2'}),
        makeSpan({start_timestamp: 4, op: 'span 4', parent_span_id: '1'}),
      ]),
    });

    // 0
    // 1
    //  2
    //   3
    //  4
    tree.zoomIn(node, true, {api, organization});
    await waitFor(() => {
      expect(node.zoomedIn).toBe(true);
    });
    expect(request).toHaveBeenCalled();

    expect(tree.list.length).toBe(7);

    assertTransactionNode(tree.list[1]);
    assertSpanNode(tree.list[2]);
    assertSpanNode(tree.list[3]);

    expect(tree.list[1].value.start_timestamp).toBe(0);
    expect(tree.list[2].value.start_timestamp).toBe(1);
    expect(tree.list[3].value.start_timestamp).toBe(2);
  });

  it('appends a tree to another tree', () => {
    const tree1 = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            transaction: 'txn 1',
            start_timestamp: 0,
            children: [makeTransaction({start_timestamp: 1, transaction: 'txn 2'})],
          }),
        ],
      }),
      null,
      null
    );

    const tree2 = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            transaction: 'txn 3',
            start_timestamp: 2,
            children: [makeTransaction({start_timestamp: 3, transaction: 'txn 4'})],
          }),
        ],
      }),
      null,
      null
    );

    tree1.appendTree(tree2);

    expect(tree1.list.length).toBe(5);
  });

  it('preserves input order', () => {
    const firstChild = makeTransaction({
      start_timestamp: 0,
      timestamp: 1,
      children: [],
    });

    const secondChild = makeTransaction({
      start_timestamp: 1,
      timestamp: 2,
      children: [],
    });

    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            start_timestamp: 0,
            timestamp: 2,
            children: [firstChild, secondChild],
          }),
          makeTransaction({
            start_timestamp: 2,
            timestamp: 4,
          }),
        ],
      }),
      null,
      null
    );

    expect(tree.list).toHaveLength(5);

    expect(tree.expand(tree.list[1], false)).toBe(true);
    expect(tree.list).toHaveLength(3);
    expect(tree.expand(tree.list[1], true)).toBe(true);
    expect(tree.list).toHaveLength(5);
    expect(tree.list[2].value).toBe(firstChild);
    expect(tree.list[3].value).toBe(secondChild);
  });

  it('creates children -> parent references', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            start_timestamp: 0,
            timestamp: 2,
            children: [makeTransaction({start_timestamp: 1, timestamp: 2})],
          }),
          makeTransaction({
            start_timestamp: 2,
            timestamp: 4,
          }),
        ],
      }),
      null,
      null
    );

    expect(tree.list).toHaveLength(4);
    expect(tree.list[2].parent?.value).toBe(tree.list[1].value);
  });

  it('establishes parent-child relationships', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            children: [makeTransaction()],
          }),
        ],
      }),
      null,
      null
    );

    expect(tree.root.children).toHaveLength(1);
    expect(tree.root.children[0].children).toHaveLength(1);
  });

  it('isLastChild', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            children: [makeTransaction(), makeTransaction()],
          }),
          makeTransaction(),
        ],
        orphan_errors: [],
      }),
      null,
      null
    );

    tree.expand(tree.list[1], true);

    expect(tree.list[0].isLastChild).toBe(true);
    expect(tree.list[1].isLastChild).toBe(false);
    expect(tree.list[2].isLastChild).toBe(false);
    expect(tree.list[3].isLastChild).toBe(true);
    expect(tree.list[4].isLastChild).toBe(true);
  });

  describe('connectors', () => {
    it('computes transaction connectors', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'sibling',
              children: [
                makeTransaction({transaction: 'child'}),
                makeTransaction({transaction: 'child'}),
              ],
            }),
            makeTransaction({transaction: 'sibling'}),
          ],
        }),
        null,
        null
      );

      // -1  root
      // ------ list begins here
      //    0 transaction
      //      0 |- sibling
      //   -1, 2|  | - child
      //      -1|  | - child
      //      0 |- sibling

      tree.expand(tree.list[1], true);
      expect(tree.list.length).toBe(5);

      expect(tree.list[0].connectors.length).toBe(0);

      expect(tree.list[1].connectors.length).toBe(1);
      expect(tree.list[1].connectors[0]).toBe(-1);

      expect(tree.list[2].connectors[0]).toBe(-1);
      expect(tree.list[2].connectors[1]).toBe(2);
      expect(tree.list[2].connectors.length).toBe(2);

      expect(tree.list[3].connectors[0]).toBe(-1);
      expect(tree.list[3].connectors.length).toBe(1);

      expect(tree.list[4].connectors.length).toBe(0);
    });

    it('computes span connectors', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              project_slug: 'project',
              event_id: 'event_id',
              transaction: 'transaction',
              children: [],
            }),
          ],
        }),
        null,
        null
      );

      // root
      //  |- node1 []
      //  |- node2 []

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEvent({}, [makeSpan({start_timestamp: 0, op: 'span', span_id: '1'})]),
      });

      expect(tree.list.length).toBe(2);

      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(tree.list.length).toBe(3);
      });

      // root
      //  |- node1 []
      //  |- node2 []
      //   |- span1 []

      const span = tree.list[tree.list.length - 1];
      expect(span.connectors.length).toBe(0);
    });
  });

  describe('expanding', () => {
    it('expands a node and updates the list', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({transactions: [makeTransaction({children: [makeTransaction()]})]}),
        null,
        null
      );

      const node = tree.list[1];

      expect(tree.expand(node, false)).toBe(true);

      expect(tree.list.length).toBe(2);
      expect(node.expanded).toBe(false);
      expect(tree.expand(node, true)).toBe(true);
      expect(node.expanded).toBe(true);
      // Assert that the list has been updated
      expect(tree.list).toHaveLength(3);
      expect(tree.list[2]).toBe(node.children[0]);
    });

    it('collapses a node and updates the list', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({transactions: [makeTransaction({children: [makeTransaction()]})]}),
        null,
        null
      );

      const node = tree.list[1];

      tree.expand(node, true);
      expect(tree.list.length).toBe(3);
      expect(tree.expand(node, false)).toBe(true);
      expect(node.expanded).toBe(false);
      // Assert that the list has been updated
      expect(tree.list).toHaveLength(2);
      expect(tree.list[1]).toBe(node);
    });

    it('preserves children expanded state', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              children: [
                makeTransaction({children: [makeTransaction({start_timestamp: 1000})]}),
                makeTransaction({start_timestamp: 5}),
              ],
            }),
          ],
        }),
        null,
        null
      );

      expect(tree.expand(tree.list[2], false)).toBe(true);
      // Assert that the list has been updated
      expect(tree.list).toHaveLength(4);

      expect(tree.expand(tree.list[2], true)).toBe(true);
      expect(tree.list.length).toBe(5);
      expect(tree.list[tree.list.length - 1].value).toEqual(
        makeTransaction({start_timestamp: 5})
      );
    });

    it('expanding or collapsing a zoomed in node doesnt do anything', async () => {
      const organization = OrganizationFixture();
      const api = new MockApiClient();

      const tree = TraceTree.FromTrace(
        makeTrace({transactions: [makeTransaction({children: [makeTransaction()]})]}),
        null,
        null
      );

      const node = tree.list[0];

      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/undefined:undefined/?averageColumn=span.self_time&averageColumn=span.duration',
        method: 'GET',
        body: makeEvent(),
      });

      tree.zoomIn(node, true, {api, organization});
      await waitFor(() => {
        expect(node.zoomedIn).toBe(true);
      });
      expect(request).toHaveBeenCalled();
      expect(tree.expand(node, true)).toBe(false);
    });

    it('expanding', async () => {
      const organization = OrganizationFixture();
      const api = new MockApiClient();

      const tree = TraceTree.FromTrace(
        makeTrace({transactions: [makeTransaction({children: [makeTransaction()]})]}),
        null,
        null
      );

      const node = tree.list[0];

      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/undefined:undefined/?averageColumn=span.self_time&averageColumn=span.duration',
        method: 'GET',
        body: makeEvent(),
      });

      tree.zoomIn(node, true, {api, organization});
      await waitFor(() => {
        expect(node.zoomedIn).toBe(true);
      });
      expect(request).toHaveBeenCalled();
      expect(tree.expand(node, true)).toBe(false);
    });

    it('accounts for intermediary expanded or collapsed nodes in autogrouped chain', async () => {
      const organization = OrganizationFixture();
      const api = new MockApiClient();

      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({project_slug: 'project', event_id: 'event_id'}),
          ],
        }),
        null,
        null
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEvent({}, [
          makeSpan({start_timestamp: 0, op: 'span', span_id: 'root'}),
          makeSpan({
            start_timestamp: 10,
            op: 'last',
            span_id: 'last',
            parent_span_id: 'root',
          }),
          makeSpan({
            start_timestamp: 0,
            op: 'db',
            parent_span_id: 'root',
            span_id: 'first-db',
          }),
          makeSpan({
            start_timestamp: 0,
            op: 'db',
            parent_span_id: 'first-db',
            span_id: 'second-db',
          }),
          makeSpan({
            start_timestamp: 0,
            op: 'other',
            parent_span_id: 'second-db',
            span_id: 'other',
          }),
          makeSpan({
            start_timestamp: 0,
            op: 'another',
            parent_span_id: 'second-db',
            span_id: 'other',
          }),
        ]),
      });

      tree.zoomIn(tree.list[1], true, {api, organization});

      await waitFor(() => {
        expect(tree.list[1].zoomedIn).toBe(true);
      });

      // expand autogroup
      tree.expand(tree.list[3], true);
      const last = tree.list[tree.list.length - 1];
      // root
      //  transaction
      //    span
      //      parent autogroup (2) <-- expand the autogroup and collapse nodes between head/tail
      //        db <--- collapse
      //        db <--- collapse
      //          other
      //          another
      //        last

      // collapse innermost two children
      tree.expand(tree.list[5], false);
      tree.expand(tree.list[4], false);
      // collapse autogroup
      tree.expand(tree.list[3], false);
      tree.expand(tree.list[3], true);
      expect(tree.list[tree.list.length - 1]).toBe(last);
    });
  });

  describe('zooming', () => {
    it('marks node as zoomed in', async () => {
      const organization = OrganizationFixture();
      const api = new MockApiClient();

      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({project_slug: 'project', event_id: 'event_id'}),
          ],
        }),
        null,
        null
      );

      const request = MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEvent(),
      });
      const node = tree.list[1];

      expect(node.zoomedIn).toBe(false);
      tree.zoomIn(node, true, {api, organization});

      await waitFor(() => {
        expect(node.zoomedIn).toBe(true);
      });

      expect(request).toHaveBeenCalled();
    });
    it('fetches spans for node when zooming in', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'txn',
              project_slug: 'project',
              event_id: 'event_id',
            }),
          ],
        }),
        null,
        null
      );

      const request = MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEvent({}, [makeSpan()]),
      });

      const node = tree.list[1];
      expect(node.children).toHaveLength(0);
      tree.zoomIn(node, true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      expect(request).toHaveBeenCalled();
      await waitFor(() => {
        expect(node.children).toHaveLength(1);
      });
      // Assert that the children have been updated
      assertTransactionNode(node.children[0].parent);
      expect(node.children[0].parent.value.transaction).toBe('txn');
      expect(node.children[0].depth).toBe(node.depth + 1);
    });

    it('handles orphaned transaction nodes', async () => {
      // Data quality issue where children transactions cannot be
      // reparented under the fetched spans
      //
      // transaction <-- zooming          transaction
      //   - child transaction              - span
      //   - another child transaction        - child transaction
      //                                    - another child transaction (orphaned)

      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'root',
              project_slug: 'project',
              event_id: 'event_id',
              children: [
                makeTransaction({transaction: 'child', parent_span_id: 'span'}),
                makeTransaction({transaction: 'another child'}),
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
        body: makeEvent({}, [makeSpan({span_id: 'span'})]),
      });

      assertTransactionNode(tree.list[tree.list.length - 1]);

      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(tree.list[1].zoomedIn).toBe(true);
      });

      const last = tree.list[tree.list.length - 1];
      assertTransactionNode(last);
      expect(last.value.transaction).toBe('another child');
    });

    it('handles bottom up zooming', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'transaction',
              project_slug: 'project',
              event_id: 'event_id',
              children: [
                makeTransaction({
                  parent_span_id: 'span',
                  transaction: 'child transaction',
                  project_slug: 'child_project',
                  event_id: 'child_event_id',
                }),
              ],
            }),
          ],
        }),
        null,
        null
      );

      const first_request = MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEvent({}, [makeSpan({op: 'db', span_id: 'span'})]),
      });

      const second_request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/child_project:child_event_id/?averageColumn=span.self_time&averageColumn=span.duration',
        method: 'GET',
        body: makeEvent({}, [
          makeSpan({op: 'db', span_id: 'span'}),
          makeSpan({op: 'db', span_id: 'span 1', parent_span_id: 'span'}),
          makeSpan({op: 'db', span_id: 'span 2', parent_span_id: 'span 1'}),
          makeSpan({op: 'db', span_id: 'span 3', parent_span_id: 'span 2'}),
          makeSpan({op: 'db', span_id: 'span 4', parent_span_id: 'span 3'}),
          makeSpan({op: 'db', span_id: 'span 5', parent_span_id: 'span 4'}),
        ]),
      });

      tree.zoomIn(tree.list[2], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(second_request).toHaveBeenCalled();
      });

      assertParentAutogroupedNode(tree.list[tree.list.length - 1]);

      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(first_request).toHaveBeenCalled();
      });

      assertParentAutogroupedNode(tree.list[tree.list.length - 1]);
    });
    it('zooms out', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({project_slug: 'project', event_id: 'event_id'}),
          ],
        }),
        null,
        null
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEvent({}, [makeSpan({span_id: 'span1', description: 'span1'})]),
      });
      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        assertSpanNode(tree.list[1].children[0]);
        expect(tree.list[1].children[0].value.description).toBe('span1');
      });

      tree.zoomIn(tree.list[1], false, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        // Assert child no longer points to children
        expect(tree.list[1].zoomedIn).toBe(false);
        expect(tree.list[1].children[0]).toBe(undefined);
        expect(tree.list[2]).toBe(undefined);
      });
    });

    it('zooms in and out', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({project_slug: 'project', event_id: 'event_id'}),
          ],
        }),
        null,
        null
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEvent({}, [makeSpan({span_id: 'span 1', description: 'span1'})]),
      });
      // Zoom in
      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });
      await waitFor(() => {
        expect(tree.list[1].zoomedIn).toBe(true);
        assertSpanNode(tree.list[1].children[0]);
        expect(tree.list[1].children[0].value.description).toBe('span1');
      });
      // Zoom out
      tree.zoomIn(tree.list[1], false, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });
      await waitFor(() => {
        expect(tree.list[2]).toBe(undefined);
      });
      // Zoom in
      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });
      await waitFor(() => {
        assertSpanNode(tree.list[1].children[0]);
        expect(tree.list[1].children[0].value?.description).toBe('span1');
      });
    });
    it('zooms in and out preserving siblings', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              project_slug: 'project',
              event_id: 'event_id',
              start_timestamp: 0,
              children: [
                makeTransaction({
                  start_timestamp: 1,
                  timestamp: 2,
                  project_slug: 'other_project',
                  event_id: 'event_id',
                }),
                makeTransaction({start_timestamp: 2, timestamp: 3}),
              ],
            }),
          ],
        }),
        null,
        null
      );

      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/other_project:event_id/?averageColumn=span.self_time&averageColumn=span.duration',
        method: 'GET',
        body: makeEvent({}, [makeSpan({description: 'span1'})]),
      });
      tree.expand(tree.list[1], true);
      tree.zoomIn(tree.list[2], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      expect(request).toHaveBeenCalled();

      // Zoom in
      await waitFor(() => {
        expect(tree.list.length).toBe(5);
      });

      // Zoom out
      tree.zoomIn(tree.list[2], false, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(tree.list.length).toBe(4);
      });
    });
    it('preserves expanded state when zooming in and out', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              project_slug: 'project',
              event_id: 'event_id',
              transaction: 'root',
              children: [
                makeTransaction({
                  project_slug: 'other_project',
                  event_id: 'event_id',
                  transaction: 'child',
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
        body: makeEvent({}, [
          makeSpan({description: 'span1'}),
          makeSpan({description: 'span2'}),
        ]),
      });

      tree.expand(tree.list[1], true);
      expect(tree.list.length).toBe(3);

      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(tree.list.length).toBe(5);
      });

      tree.zoomIn(tree.list[1], false, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(tree.list.length).toBe(3);
      });
      expect(tree.list[1].expanded).toBe(true);
    });
  });

  describe('autogrouping', () => {
    it('auto groups sibling spans and preserves tail spans', () => {
      const root = new TraceTreeNode(null, makeSpan({description: 'span1'}), {
        project_slug: '',
        event_id: '',
      });

      for (let i = 0; i < 5; i++) {
        root.children.push(
          new TraceTreeNode(root, makeSpan({description: 'span', op: 'db'}), {
            project_slug: '',
            event_id: '',
          })
        );
      }

      root.children.push(
        new TraceTreeNode(root, makeSpan({description: 'span', op: 'http'}), {
          project_slug: '',
          event_id: '',
        })
      );

      expect(root.children.length).toBe(6);

      TraceTree.AutogroupSiblingSpanNodes(root);

      expect(root.children.length).toBe(2);
    });

    it('autogroups when number of children is exactly 5', () => {
      const root = new TraceTreeNode(null, makeSpan({description: 'span1'}), {
        project_slug: '',
        event_id: '',
      });

      for (let i = 0; i < 5; i++) {
        root.children.push(
          new TraceTreeNode(root, makeSpan({description: 'span', op: 'db'}), {
            project_slug: '',
            event_id: '',
          })
        );
      }

      expect(root.children.length).toBe(5);

      TraceTree.AutogroupSiblingSpanNodes(root);

      expect(root.children.length).toBe(1);
    });

    it('collects errors and performance issues for sibling autogrouped node', () => {
      const root = new TraceTreeNode(null, makeSpan({description: 'span1'}), {
        project_slug: '',
        event_id: '',
      });

      for (let i = 0; i < 5; i++) {
        const node = new TraceTreeNode(root, makeSpan({description: 'span', op: 'db'}), {
          project_slug: '',
          event_id: '',
        });
        node.errors.add(makeTraceError());
        node.performance_issues.add(makeTracePerformanceIssue());
        root.children.push(node);
      }

      expect(root.children.length).toBe(5);

      TraceTree.AutogroupSiblingSpanNodes(root);

      expect(root.children.length).toBe(1);
      const autogroupedNode = root.children[0];
      assertSiblingAutogroupedNode(autogroupedNode);
      expect(autogroupedNode.has_errors).toBe(true);
      expect(autogroupedNode.errors.size).toBe(5);
      expect(autogroupedNode.performance_issues.size).toBe(5);
    });

    it('adds autogrouped siblings as children under autogrouped node', () => {
      const root = new TraceTreeNode(null, makeSpan({description: 'span1'}), {
        project_slug: '',
        event_id: '',
      });

      for (let i = 0; i < 5; i++) {
        root.children.push(
          new TraceTreeNode(root, makeSpan({description: 'span', op: 'db'}), {
            project_slug: '',
            event_id: '',
          })
        );
      }

      expect(root.children.length).toBe(5);

      TraceTree.AutogroupSiblingSpanNodes(root);

      expect(root.children.length).toBe(1);

      const autoGroupedNode = root.children[0];
      assertAutogroupedNode(autoGroupedNode);

      expect(autoGroupedNode.groupCount).toBe(5);
      expect(autoGroupedNode.children.length).toBe(5);
    });

    it('autogroups when number of children is > 5', () => {
      const root = new TraceTreeNode(null, makeSpan({description: 'span1'}), {
        project_slug: '',
        event_id: '',
      });

      for (let i = 0; i < 7; i++) {
        root.children.push(
          new TraceTreeNode(root, makeSpan({description: 'span', op: 'db'}), {
            project_slug: '',
            event_id: '',
          })
        );
      }

      expect(root.children.length).toBe(7);

      TraceTree.AutogroupSiblingSpanNodes(root);

      expect(root.children.length).toBe(1);
    });

    it('autogroups direct children case', () => {
      // db             db                           db
      //  http    ->     parent autogroup (3) ->      parent autogroup (3)
      //   http                                        http
      //    http                                        http
      //                                                 http

      const root: TraceTreeNode<TraceTree.Span> = new TraceTreeNode(
        null,
        makeSpan({
          description: `span1`,
          span_id: `1`,
          op: 'db',
        }),
        {project_slug: '', event_id: ''}
      );

      let last: TraceTreeNode<any> = root;

      for (let i = 0; i < 3; i++) {
        const node = new TraceTreeNode(
          last,
          makeSpan({
            description: `span${i}`,
            span_id: `${i}`,
            op: 'http',
          }),
          {
            project_slug: '',
            event_id: '',
          }
        );

        last.children.push(node);
        last = node;
      }

      if (!root) {
        throw new Error('root is null');
      }

      expect(root.children.length).toBe(1);
      expect(root.children[0].children.length).toBe(1);

      TraceTree.AutogroupDirectChildrenSpanNodes(root);

      expect(root.children.length).toBe(1);

      assertAutogroupedNode(root.children[0]);
      expect(root.children[0].children.length).toBe(0);

      root.children[0].expanded = true;
      expect((root.children[0].children[0].value as RawSpanType).description).toBe(
        'span0'
      );
    });

    it('collects errors and performance issues for parent autogrouped node', () => {
      // db             db                           db
      //  http    ->     parent autogroup (3) ->      parent autogroup (3)
      //   http                                        http
      //    http                                        http
      //                                                 http
      const root: TraceTreeNode<TraceTree.Span> = new TraceTreeNode(
        null,
        makeSpan({
          description: `span1`,
          span_id: `1`,
          op: 'db',
        }),
        {project_slug: '', event_id: ''}
      );

      let last: TraceTreeNode<any> = root;

      for (let i = 0; i < 3; i++) {
        const node = new TraceTreeNode(
          last,
          makeSpan({
            description: `span${i}`,
            span_id: `${i}`,
            op: 'http',
          }),
          {
            project_slug: '',
            event_id: '',
          }
        );
        node.errors.add(makeTraceError());
        node.performance_issues.add(makeTracePerformanceIssue());
        last.children.push(node);
        last = node;
      }

      if (!root) {
        throw new Error('root is null');
      }

      expect(root.children.length).toBe(1);
      expect(root.children[0].children.length).toBe(1);

      TraceTree.AutogroupDirectChildrenSpanNodes(root);

      expect(root.children.length).toBe(1);

      assertAutogroupedNode(root.children[0]);
      expect(root.children[0].has_errors).toBe(true);
      expect(root.children[0].errors.size).toBe(3);
      expect(root.children[0].performance_issues.size).toBe(3);
    });

    it('autogrouping direct children skips rendering intermediary nodes', () => {
      // db            db                     db
      //  http          autogrouped (3)        autogrouped (3)
      //   http   ->     db               ->    http
      //    http                                 http
      //     db                                   http
      //                                           db
      const root = new TraceTreeNode(
        null,
        makeSpan({span_id: 'span1', description: 'span1', op: 'db'}),
        {
          project_slug: '',
          event_id: '',
        }
      );

      let last = root;
      for (let i = 0; i < 4; i++) {
        const node = new TraceTreeNode(
          last,
          makeSpan({
            span_id: `span`,
            description: `span`,
            op: i === 3 ? 'db' : 'http',
          }),
          {
            project_slug: '',
            event_id: '',
          }
        );
        last.children.push(node);
        last = node;
      }

      TraceTree.AutogroupDirectChildrenSpanNodes(root);

      const autoGroupedNode = root.children[0];
      assertAutogroupedNode(autoGroupedNode);

      expect(autoGroupedNode.children.length).toBe(1);
      expect((autoGroupedNode.children[0].value as RawSpanType).op).toBe('db');

      autoGroupedNode.expanded = true;
      expect(autoGroupedNode.children.length).toBe(1);
      expect((autoGroupedNode.children[0].value as RawSpanType).op).toBe('http');
    });

    it('nested direct autogrouping', () => {
      // db             db                           db
      //  http    ->     parent autogroup (3) ->      parent autogroup (3)
      //   http           db                             http
      //    http           parent autogroup (3)           http
      //     db                                            http
      //      http                                          db
      //       http                                          parent autogrouped (3)
      //        http                                          http
      //                                                       http
      //                                                        http
      const root = new TraceTreeNode(
        null,
        makeSpan({span_id: 'span', description: 'span', op: 'db'}),
        {
          project_slug: '',
          event_id: '',
        }
      );

      let last = root;

      for (let i = 0; i < 3; i++) {
        if (i === 1) {
          const autogroupBreakingSpan = new TraceTreeNode(
            last,
            makeSpan({span_id: 'span', description: 'span', op: 'db'}),
            {
              project_slug: '',
              event_id: '',
            }
          );

          last.children.push(autogroupBreakingSpan);
          last = autogroupBreakingSpan;
        } else {
          for (let j = 0; j < 3; j++) {
            const node = new TraceTreeNode(
              last,
              makeSpan({span_id: `span${j}`, description: `span${j}`, op: 'http'}),
              {
                project_slug: '',
                event_id: '',
              }
            );
            last.children.push(node);
            last = node;
          }
        }
      }

      TraceTree.AutogroupDirectChildrenSpanNodes(root);

      assertAutogroupedNode(root.children[0]);
      assertAutogroupedNode(root.children[0].children[0].children[0]);
    });

    it('sibling autogrouping', () => {
      // db          db
      //  http        sibling autogrouped (5)
      //  http
      //  http  ->
      //  http
      //  http
      const root = new TraceTreeNode(
        null,
        makeTransaction({start_timestamp: 0, timestamp: 10}),
        {
          project_slug: '',
          event_id: '',
        }
      );

      for (let i = 0; i < 5; i++) {
        root.children.push(
          new TraceTreeNode(
            root,
            makeSpan({start_timestamp: i, op: 'db', timestamp: i + 1}),
            {
              project_slug: '',
              event_id: '',
            }
          )
        );
      }

      TraceTree.AutogroupSiblingSpanNodes(root);
      expect(root.children.length).toBe(1);
      assertAutogroupedNode(root.children[0]);
    });

    it('multiple sibling autogrouping', () => {
      // db          db
      //  http        sibling autogrouped (5)
      //  http        db
      //  http  ->    sibling autogrouped (5)
      //  http
      //  http
      //  db
      //  http
      //  http
      //  http
      //  http
      //  http
      const root = new TraceTreeNode(
        null,
        makeTransaction({start_timestamp: 0, timestamp: 10}),
        {
          project_slug: '',
          event_id: '',
        }
      );

      for (let i = 0; i < 10; i++) {
        if (i === 5) {
          root.children.push(
            new TraceTreeNode(
              root,
              makeSpan({start_timestamp: i, timestamp: i + 1, op: 'db'}),
              {
                project_slug: '',
                event_id: '',
              }
            )
          );
        }

        root.children.push(
          new TraceTreeNode(
            root,
            makeSpan({start_timestamp: i, timestamp: i + 1, op: 'http'}),
            {
              project_slug: '',
              event_id: '',
            }
          )
        );
      }

      TraceTree.AutogroupSiblingSpanNodes(root);
      assertAutogroupedNode(root.children[0]);
      expect(root.children).toHaveLength(3);
      assertAutogroupedNode(root.children[2]);
    });

    it('renders children of autogrouped direct children nodes', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: '/',
              project_slug: 'project',
              event_id: 'event_id',
            }),
          ],
        }),
        null,
        null
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEvent({}, [
          makeSpan({description: 'parent span', op: 'http', span_id: '1'}),
          makeSpan({description: 'span', op: 'db', span_id: '2', parent_span_id: '1'}),
          makeSpan({description: 'span', op: 'db', span_id: '3', parent_span_id: '2'}),
          makeSpan({description: 'span', op: 'db', span_id: '4', parent_span_id: '3'}),
          makeSpan({description: 'span', op: 'db', span_id: '5', parent_span_id: '4'}),
          makeSpan({
            description: 'span',
            op: 'redis',
            span_id: '6',
            parent_span_id: '5',
          }),
          makeSpan({description: 'span', op: 'https', parent_span_id: '1'}),
        ]),
      });

      expect(tree.list.length).toBe(2);
      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(tree.list.length).toBe(6);
      });

      const autogroupedNode = tree.list[tree.list.length - 3];
      assertParentAutogroupedNode(autogroupedNode);
      expect('autogrouped_by' in autogroupedNode?.value).toBeTruthy();
      expect(autogroupedNode.groupCount).toBe(4);

      expect(autogroupedNode.head.value.span_id).toBe('2');
      expect(autogroupedNode.tail.value.span_id).toBe('5');

      // Expand autogrouped node
      expect(tree.expand(autogroupedNode, true)).toBe(true);
      expect(tree.list.length).toBe(10);

      // Collapse autogrouped node
      expect(tree.expand(autogroupedNode, false)).toBe(true);
      expect(tree.list.length).toBe(6);

      expect(autogroupedNode.children[0].depth).toBe(4);
    });
  });

  describe('incremental trace fetch', () => {
    const organization = OrganizationFixture();

    beforeEach(function () {
      jest.clearAllMocks();
      jest.spyOn(useOrganization, 'default').mockReturnValue(organization);
    });

    it('Fetches and updates tree with fetched trace', async () => {
      const traces = [
        {traceSlug: 'slug1', timestamp: 1},
        {traceSlug: 'slug2', timestamp: 2},
      ];

      const tree: TraceTree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'txn 1',
              start_timestamp: 0,
              children: [makeTransaction({start_timestamp: 1, transaction: 'txn 2'})],
            }),
          ],
        }),
        null,
        null
      );

      // Mock the API calls
      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/events-trace/slug1/?limit=10000&timestamp=1&useSpans=1',
        body: {
          transactions: [
            makeTransaction({
              transaction: 'txn 3',
              start_timestamp: 0,
              children: [makeTransaction({start_timestamp: 1, transaction: 'txn 4'})],
            }),
          ],
          orphan_errors: [],
        },
      });
      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/events-trace/slug2/?limit=10000&timestamp=2&useSpans=1',
        body: {
          transactions: [
            makeTransaction({
              transaction: 'txn 5',
              start_timestamp: 0,
              children: [makeTransaction({start_timestamp: 1, transaction: 'txn 6'})],
            }),
          ],
          orphan_errors: [],
        },
      });

      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/events-trace/slug1/?limit=10000&timestamp=1&useSpans=1',
        body: {
          transactions: [
            makeTransaction({
              transaction: 'txn 3',
              start_timestamp: 0,
              children: [makeTransaction({start_timestamp: 1, transaction: 'txn 4'})],
            }),
          ],
          orphan_errors: [],
        },
      });

      expect(tree.list.length).toBe(3);

      tree.fetchAdditionalTraces({
        replayTraces: traces,
        api: new MockApiClient(),
        filters: {},
        organization,
        rerender: () => {},
        urlParams: {} as Location['query'],
        metaResults: null,
      });

      await waitFor(() => expect(tree.root.children[0].fetchStatus).toBe('idle'));

      expect(tree.list.length).toBe(7);
    });

    it('Does not infinitely fetch on error', async () => {
      const traces = [
        {traceSlug: 'slug1', timestamp: 1},
        {traceSlug: 'slug2', timestamp: 2},
        {traceSlug: 'slug3', timestamp: 3},
      ];

      const tree: TraceTree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'txn 1',
              start_timestamp: 0,
              children: [makeTransaction({start_timestamp: 1, transaction: 'txn 2'})],
            }),
          ],
        }),
        null,
        null
      );

      // Mock the API calls
      const mockedResponse1 = MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/events-trace/slug1/?limit=10000&timestamp=1&useSpans=1',
        statusCode: 400,
      });
      const mockedResponse2 = MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/events-trace/slug2/?limit=10000&timestamp=2&useSpans=1',
        body: {
          transactions: [
            makeTransaction({
              transaction: 'txn 5',
              start_timestamp: 0,
              children: [makeTransaction({start_timestamp: 1, transaction: 'txn 6'})],
            }),
          ],
          orphan_errors: [],
        },
      });
      const mockedResponse3 = MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/events-trace/slug3/?limit=10000&timestamp=3&useSpans=1',
        body: {
          transactions: [
            makeTransaction({
              transaction: 'txn 7',
              start_timestamp: 0,
              children: [makeTransaction({start_timestamp: 1, transaction: 'txn 8'})],
            }),
          ],
          orphan_errors: [],
        },
      });

      expect(tree.list.length).toBe(3);

      tree.fetchAdditionalTraces({
        replayTraces: traces,
        api: new MockApiClient(),
        filters: {},
        organization,
        rerender: () => {},
        urlParams: {} as Location['query'],
        metaResults: null,
      });

      await waitFor(() => expect(tree.root.children[0].fetchStatus).toBe('idle'));

      expect(tree.list.length).toBe(7);
      expect(mockedResponse1).toHaveBeenCalledTimes(1);
      expect(mockedResponse2).toHaveBeenCalledTimes(1);
      expect(mockedResponse3).toHaveBeenCalledTimes(1);
    });
  });

  describe('SSR', () => {
    it('makes pageload transaction a parent of server handler transaction', () => {
      const tree: TraceTree = TraceTree.FromTrace(
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
              ],
            }),
          ],
        }),
        null,
        null
      );

      const root = tree.root.children[0];
      expect(root?.children?.[0]?.value?.['transaction.op']).toBe('pageload');
      expect(root?.children?.[0]?.children?.[0]?.value?.['transaction.op']).toBe(
        'http.server'
      );
    });

    it('skips reparenting if server handler has multiple direct transaction children', () => {
      const tree: TraceTree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'SSR',
              ['transaction.op']: 'http.server',
              children: [
                makeTransaction({
                  transaction: 'first pageload',
                  ['transaction.op']: 'pageload',
                }),
                makeTransaction({
                  transaction: 'second pageload',
                  ['transaction.op']: 'pageload',
                }),
              ],
            }),
          ],
        }),
        null,
        null
      );

      const transaction = tree.list[1];
      assertTransactionNode(transaction);
      expect(transaction.value.transaction).toBe('SSR');

      const firstPageload = tree.list[2];
      assertTransactionNode(firstPageload);
      expect(firstPageload.value.transaction).toBe('first pageload');

      const secondPageload = tree.list[3];
      assertTransactionNode(secondPageload);
      expect(secondPageload.value.transaction).toBe('second pageload');
    });
    it('doesnt reparent http.server child txn under browser request span if it was not reparented', async () => {
      const tree: TraceTree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'pageload',
              ['transaction.op']: 'pageload',
              event_id: 'pageload',
              project_slug: 'js',
              children: [
                makeTransaction({
                  transaction: 'http.server',
                  ['transaction.op']: 'http.server',
                }),
              ],
            }),
          ],
        }),
        null,
        null
      );
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/js:pageload/?averageColumn=span.self_time&averageColumn=span.duration',
        method: 'GET',
        body: makeEvent({}, [makeSpan({description: 'request', op: 'browser'})]),
      });

      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => tree.list.length === 4);

      const pageloadTransaction = tree.list[1];
      const serverHandlerTransaction = tree.list[3];
      expect(serverHandlerTransaction.parent).toBe(pageloadTransaction);
    });
    describe('expanded', () => {
      it.each([['browser'], ['browser.request']])(
        'server handler transaction becomes a child of %s span if present',
        async span_op => {
          const tree: TraceTree = TraceTree.FromTrace(
            makeTrace({
              transactions: [
                makeTransaction({
                  transaction: 'SSR',
                  event_id: 'ssr',
                  project_slug: 'js',
                  ['transaction.op']: 'http.server',
                  children: [
                    makeTransaction({
                      transaction: 'pageload',
                      ['transaction.op']: 'pageload',
                    }),
                  ],
                }),
              ],
            }),
            null,
            null
          );

          MockApiClient.addMockResponse({
            url: '/organizations/org-slug/events/js:ssr/?averageColumn=span.self_time&averageColumn=span.duration',
            method: 'GET',
            body: makeEvent({}, [makeSpan({description: 'request', op: span_op})]),
          });

          tree.zoomIn(tree.list[1], true, {
            api: new MockApiClient(),
            organization: OrganizationFixture(),
          });

          await waitFor(() => tree.list.length === 4);
          const browserRequestSpan = tree.list[1].children[0];
          const ssrTransaction = browserRequestSpan.children[0];

          assertSpanNode(browserRequestSpan);
          assertTransactionNode(ssrTransaction);
          expect(ssrTransaction.value.transaction).toBe('SSR');
        }
      );
      it('server handler transaction becomes a direct child if there is no matching browser request span', async () => {
        const tree: TraceTree = TraceTree.FromTrace(
          makeTrace({
            transactions: [
              makeTransaction({
                transaction: 'SSR',
                event_id: 'ssr',
                project_slug: 'js',
                ['transaction.op']: 'http.server',
                children: [
                  makeTransaction({
                    transaction: 'pageload',
                    ['transaction.op']: 'pageload',
                  }),
                ],
              }),
            ],
          }),
          null,
          null
        );

        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/js:ssr/?averageColumn=span.self_time&averageColumn=span.duration',
          method: 'GET',
          body: makeEvent({}, [makeSpan({description: 'request', op: 'almost-browser'})]),
        });

        tree.zoomIn(tree.list[1], true, {
          api: new MockApiClient(),
          organization: OrganizationFixture(),
        });

        await waitFor(() => tree.list.length === 4);

        const transaction = tree.list[tree.list.length - 1];
        assertTransactionNode(transaction);
        expect(transaction.value.transaction).toBe('SSR');
      });
    });
  });
});
