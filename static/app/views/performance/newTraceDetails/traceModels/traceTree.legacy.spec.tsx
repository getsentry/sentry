import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import * as useOrganization from 'sentry/utils/useOrganization';

import {TraceTree} from '../traceModels/traceTree';

import {TraceTreeNode} from './traceTreeNode';

const EVENT_REQUEST_URL =
  '/organizations/org-slug/events/project:event_id/?averageColumn=span.self_time&averageColumn=span.duration';

import {
  assertAutogroupedNode,
  assertParentAutogroupedNode,
  assertSiblingAutogroupedNode,
  assertSpanNode,
  assertTraceErrorNode,
  assertTransactionNode,
  makeEventTransaction,
  makeSpan,
  makeTrace,
  makeTraceError,
  makeTracePerformanceIssue,
  makeTransaction,
} from './traceTreeTestUtils';

describe('TreeNode', () => {
  it('expands transaction nodes by default', () => {
    const node = new TraceTreeNode(null, makeTransaction(), {
      project_slug: '',
      event_id: '',
    });
    expect(node.expanded).toBe(true);
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
        {replayRecord: null, meta: null}
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
        {replayRecord: null, meta: null}
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
        {replayRecord: null, meta: null}
      );

      expect(tree.root.space).toEqual([0, 2000]);
    });

    it('adjusts end and converts timestamp to ms', () => {
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
        {replayRecord: null, meta: null}
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
        {replayRecord: null, meta: null}
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
        expect(TraceTree.PathToNode(child.parent.parent)).toEqual(['txn-parent']);
      });
      it('leafmost node', () => {
        expect(TraceTree.PathToNode(child)).toEqual([
          'txn-grandchild',
          'txn-child',
          'txn-parent',
        ]);
      });
    });

    it('orphan errors', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [],
          orphan_errors: [makeTraceError({event_id: 'error_id'})],
        }),
        {replayRecord: null, meta: null}
      );

      expect(TraceTree.PathToNode(tree.list[1])).toEqual(['error-error_id']);
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
        {replayRecord: null, meta: null}
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEventTransaction({}, [
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

      tree.zoom(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      it('when span is a child of a txn', async () => {
        await waitFor(() => {
          expect(tree.list.length).toBe(5);
        });

        expect(TraceTree.PathToNode(tree.list[tree.list.length - 1])).toEqual([
          'span-span',
          'txn-event_id',
        ]);
      });

      it('missing instrumentation', () => {
        expect(TraceTree.PathToNode(tree.list[3])).toEqual(['ms-span', 'txn-event_id']);
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
        {replayRecord: null, meta: null}
      );

      expect(adjusted.root.space).toEqual([1000, 2000]);

      const root = TraceTree.FromSpans(
        adjusted.root,
        [makeSpan({start_timestamp: 0.5, timestamp: 3.5})],
        makeEventTransaction(),
        {sdk: undefined}
      );

      expect(root.space).toEqual([500, 3000]);
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
        {replayRecord: null, meta: null}
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEventTransaction({}, [
          makeSpan({description: 'span', op: 'db', span_id: '2'}),
          makeSpan({description: 'span', op: 'db', span_id: '3', parent_span_id: '2'}),
          makeSpan({description: 'span', op: 'db', span_id: '4', parent_span_id: '3'}),
          makeSpan({description: 'span', op: 'db', span_id: '5', parent_span_id: '4'}),
        ]),
      });

      tree.zoom(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      it('autogrouped node', async () => {
        await waitFor(() => {
          expect(tree.list.length).toBe(3);
        });
        tree.expand(tree.list[2], true);
        assertAutogroupedNode(tree.list[2]);
        expect(TraceTree.PathToNode(tree.list[2])).toEqual(['ag-2', 'txn-event_id']);
      });

      it('child is part of autogrouping', () => {
        expect(TraceTree.PathToNode(tree.list[tree.list.length - 1])).toEqual([
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
          {replayRecord: null, meta: null}
        );

        MockApiClient.addMockResponse({
          url: EVENT_REQUEST_URL,
          method: 'GET',
          body: makeEventTransaction({}, [
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

        tree.zoom(tree.list[1], true, {
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
        {replayRecord: null, meta: null}
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEventTransaction({}, [
          makeSpan({description: 'span', op: 'db', span_id: '2'}),
          makeSpan({description: 'span', op: 'db', span_id: '3', parent_span_id: '2'}),
          makeSpan({description: 'span', op: 'db', span_id: '4', parent_span_id: '3'}),
          makeSpan({description: 'span', op: 'db', span_id: '5', parent_span_id: '4'}),
          makeSpan({description: 'span', op: '6', span_id: '6', parent_span_id: '5'}),
        ]),
      });

      tree.zoom(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      it('autogrouped node', async () => {
        await waitFor(() => {
          expect(tree.list.length).toBe(4);
        });
        assertAutogroupedNode(tree.list[2]);
        expect(TraceTree.PathToNode(tree.list[2])).toEqual(['ag-2', 'txn-event_id']);
      });
      it('span node skips autogrouped node because it is not expanded', async () => {
        await waitFor(() => {
          expect(tree.list.length).toBe(4);
        });
        expect(TraceTree.PathToNode(tree.list[tree.list.length - 1])).toEqual([
          'span-6',
          'txn-event_id',
        ]);
      });
    });
  });
});

describe('TraceTree', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
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
      {replayRecord: null, meta: null}
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
      {replayRecord: null, meta: null}
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
      {replayRecord: null, meta: null}
    );

    expect(tree.list).toHaveLength(4);
    assertTraceErrorNode(tree.list[2]);
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
      {replayRecord: null, meta: null}
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
      {replayRecord: null, meta: null}
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
      {replayRecord: null, meta: null}
    );

    expect(tree.list).toHaveLength(5);

    expect(tree.expand(tree.list[1], false)).toBe(true);
    expect(tree.list).toHaveLength(3);
    expect(tree.expand(tree.list[1], true)).toBe(true);
    expect(tree.list).toHaveLength(5);
    expect(tree.list[2].value).toBe(firstChild);
    expect(tree.list[3].value).toBe(secondChild);
  });

  describe('expanding', () => {
    it('expands a node and updates the list', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({transactions: [makeTransaction({children: [makeTransaction()]})]}),
        {replayRecord: null, meta: null}
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
        {replayRecord: null, meta: null}
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
        {replayRecord: null, meta: null}
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
        {replayRecord: null, meta: null}
      );

      const node = tree.list[0];

      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/undefined:undefined/?averageColumn=span.self_time&averageColumn=span.duration',
        method: 'GET',
        body: makeEventTransaction(),
      });

      tree.zoom(node, true, {api, organization});
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
        {replayRecord: null, meta: null}
      );

      const node = tree.list[0];

      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/undefined:undefined/?averageColumn=span.self_time&averageColumn=span.duration',
        method: 'GET',
        body: makeEventTransaction(),
      });

      tree.zoom(node, true, {api, organization});
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
        {replayRecord: null, meta: null}
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEventTransaction({}, [
          makeSpan({start_timestamp: 0, op: 'span', span_id: 'root'}),
          makeSpan({
            start_timestamp: 10,
            op: 'last',
            span_id: 'last',
            parent_span_id: 'root',
          }),
          makeSpan({
            parent_span_id: 'root',
            span_id: 'first-db',
            start_timestamp: 0,
            op: 'db',
          }),
          makeSpan({
            parent_span_id: 'first-db',
            span_id: 'second-db',
            start_timestamp: 0,
            op: 'db',
          }),
          makeSpan({
            parent_span_id: 'second-db',
            span_id: 'other-db',
            start_timestamp: 0,
            op: 'other',
          }),
          makeSpan({
            parent_span_id: 'other-db',
            span_id: 'another',
            start_timestamp: 0,
            op: 'another',
          }),
        ]),
      });

      tree.zoom(tree.list[1], true, {api, organization});

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
      //          db <--- collapse
      //            other
      //            another
      //        last

      // collapse innermost two children
      tree.expand(tree.list[4], false);
      tree.expand(tree.list[5], false);

      // collapse autogroup
      tree.expand(tree.list[3], false);
      tree.expand(tree.list[3], true);

      expect(tree.list[tree.list.length - 1]).toBe(last);
    });
  });

  describe('zoom', () => {
    it('marks node as zoomed in', async () => {
      const organization = OrganizationFixture();
      const api = new MockApiClient();

      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({project_slug: 'project', event_id: 'event_id'}),
          ],
        }),
        {replayRecord: null, meta: null}
      );

      const request = MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEventTransaction(),
      });
      const node = tree.list[1];

      expect(node.zoomedIn).toBe(false);
      tree.zoom(node, true, {api, organization});

      await waitFor(() => {
        expect(node.zoomedIn).toBe(true);
      });

      expect(request).toHaveBeenCalled();
    });
    it('fetches spans for node when zoom in', async () => {
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
        {replayRecord: null, meta: null}
      );

      const request = MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEventTransaction({}, [makeSpan()]),
      });

      const node = tree.list[1];
      expect(node.children).toHaveLength(0);
      tree.zoom(node, true, {
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
      expect(TraceTree.Depth(node.children[0])).toBe(TraceTree.Depth(node) + 1);
    });

    it('handles bottom up zoom', async () => {
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
        {replayRecord: null, meta: null}
      );

      const first_request = MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEventTransaction({}, [makeSpan({op: 'db', span_id: 'span'})]),
      });

      const second_request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/child_project:child_event_id/?averageColumn=span.self_time&averageColumn=span.duration',
        method: 'GET',
        body: makeEventTransaction({}, [
          makeSpan({op: 'db', span_id: 'span'}),
          makeSpan({op: 'db', span_id: 'span 1', parent_span_id: 'span'}),
          makeSpan({op: 'db', span_id: 'span 2', parent_span_id: 'span 1'}),
          makeSpan({op: 'db', span_id: 'span 3', parent_span_id: 'span 2'}),
          makeSpan({op: 'db', span_id: 'span 4', parent_span_id: 'span 3'}),
          makeSpan({op: 'db', span_id: 'span 5', parent_span_id: 'span 4'}),
        ]),
      });

      tree.zoom(tree.list[2], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(second_request).toHaveBeenCalled();
      });

      assertParentAutogroupedNode(tree.list[tree.list.length - 1]);

      tree.zoom(tree.list[1], true, {
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
        {replayRecord: null, meta: null}
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEventTransaction({}, [
          makeSpan({span_id: 'span1', description: 'span1'}),
        ]),
      });
      tree.zoom(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        assertSpanNode(tree.list[1].children[0]);
        expect(tree.list[1].children[0].value.description).toBe('span1');
      });

      tree.zoom(tree.list[1], false, {
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
        {replayRecord: null, meta: null}
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEventTransaction({}, [
          makeSpan({span_id: 'span 1', description: 'span1'}),
        ]),
      });
      // Zoom in
      tree.zoom(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });
      await waitFor(() => {
        expect(tree.list[1].zoomedIn).toBe(true);
        assertSpanNode(tree.list[1].children[0]);
        expect(tree.list[1].children[0].value.description).toBe('span1');
      });
      // Zoom out
      tree.zoom(tree.list[1], false, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });
      await waitFor(() => {
        expect(tree.list[2]).toBe(undefined);
      });
      // Zoom in
      tree.zoom(tree.list[1], true, {
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
        {replayRecord: null, meta: null}
      );

      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/other_project:event_id/?averageColumn=span.self_time&averageColumn=span.duration',
        method: 'GET',
        body: makeEventTransaction({}, [makeSpan({description: 'span1'})]),
      });
      tree.expand(tree.list[1], true);
      tree.zoom(tree.list[2], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      expect(request).toHaveBeenCalled();

      // Zoom in
      await waitFor(() => {
        expect(tree.list.length).toBe(5);
      });

      // Zoom out
      tree.zoom(tree.list[2], false, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(tree.list.length).toBe(4);
      });
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
      expect(autogroupedNode.hasErrors).toBe(true);
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

      assertParentAutogroupedNode(root.children[0]);
      expect(root.children[0].head.hasErrors).toBe(true);
      expect(root.children[0].errors.size).toBe(3);
      expect(root.children[0].performance_issues.size).toBe(3);
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

      assertParentAutogroupedNode(root.children[0]);
      assertParentAutogroupedNode(root.children[0].tail.children[0].children[0]);
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
        {replayRecord: null, meta: null}
      );

      MockApiClient.addMockResponse({
        url: EVENT_REQUEST_URL,
        method: 'GET',
        body: makeEventTransaction({}, [
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
      tree.zoom(tree.list[1], true, {
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

      expect(TraceTree.Depth(autogroupedNode.head)).toBe(4);
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
        {replayRecord: null, meta: null}
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
        {replayRecord: null, meta: null}
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
});
