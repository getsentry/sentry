import {OrganizationFixture} from 'sentry-fixture/organization';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {EntryType, type Event} from 'sentry/types';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';

import {TraceTree, TraceTreeNode} from './traceTree';

function makeTrace(
  overrides: Partial<TraceSplitResults<TraceFullDetailed>>
): TraceSplitResults<TraceFullDetailed> {
  return {
    transactions: [],
    orphan_errors: [],
    ...overrides,
  } as TraceSplitResults<TraceFullDetailed>;
}

function makeTransaction(overrides: Partial<TraceFullDetailed> = {}): TraceFullDetailed {
  return {
    children: [],
    start_timestamp: 0,
    timestamp: 1,
    'transaction.op': '',
    'transaction.status': '',
    ...overrides,
  } as TraceFullDetailed;
}

function makeRawSpan(overrides: Partial<RawSpanType> = {}): RawSpanType {
  return {
    op: '',
    description: '',
    start_timestamp: 0,
    timestamp: 1,
    ...overrides,
  } as RawSpanType;
}

function makeTraceError(
  overrides: Partial<TraceTree.TraceError> = {}
): TraceTree.TraceError {
  return {
    title: 'MaybeEncodingError: Error sending result',
    level: 'error',
    data: {},
    ...overrides,
  } as TraceTree.TraceError;
}

function makeEvent(overrides: Partial<Event> = {}, spans: RawSpanType[] = []): Event {
  return {
    entries: [{type: EntryType.SPANS, data: spans}],
    ...overrides,
  } as Event;
}

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
      })
    );

    expect(tree.list).toHaveLength(3);
  });

  it('builds orphan errors as well', () => {
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
      })
    );

    expect(tree.list).toHaveLength(4);
  });

  it('builds from spans when root is a transaction node', () => {
    const root = new TraceTreeNode(
      null,
      makeTransaction({
        children: [],
      }),
      {project_slug: '', event_id: ''}
    );

    const node = TraceTree.FromSpans(root, [
      makeRawSpan({start_timestamp: 0, op: '1', span_id: '1'}),
      makeRawSpan({start_timestamp: 1, op: '2', span_id: '2', parent_span_id: '1'}),
      makeRawSpan({start_timestamp: 2, op: '3', parent_span_id: '2'}),
      makeRawSpan({start_timestamp: 3, op: '4', parent_span_id: '1'}),
    ]);

    // @ts-expect-error ignore type guard
    expect(node.children[0].value.span_id).toBe('1');
    // @ts-expect-error ignore type guard
    expect(node.children[0].value.start_timestamp).toBe(0);
    expect(node.children.length).toBe(1);

    // @ts-expect-error ignore type guard
    expect(node.children[0].children[0].value.start_timestamp).toBe(1);
    // @ts-expect-error ignore type guard
    expect(node.children[0].children[0].children[0].value.start_timestamp).toBe(2);
    // @ts-expect-error ignore type guard
    expect(node.children[0].children[1].value.start_timestamp).toBe(3);
  });

  it('builds and preserves list order', async () => {
    const organization = OrganizationFixture();
    const api = new MockApiClient();

    const tree = TraceTree.FromTrace(
      makeTrace({transactions: [makeTransaction({children: [makeTransaction()]})]})
    );

    tree.expand(tree.list[0], true);
    const node = tree.list[1];

    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/undefined:undefined/',
      method: 'GET',
      body: makeEvent({startTimestamp: 0}, [
        makeRawSpan({start_timestamp: 1, op: '1', span_id: '1'}),
        makeRawSpan({start_timestamp: 2, op: '2', span_id: '2', parent_span_id: '1'}),
        makeRawSpan({start_timestamp: 3, op: '3', parent_span_id: '2'}),
        makeRawSpan({start_timestamp: 4, op: '4', parent_span_id: '1'}),
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

    expect(tree.list.length).toBe(6);
    // @ts-expect-error ignore type guard
    expect(tree.list[1].value.start_timestamp).toBe(0);
    // @ts-expect-error ignore type guard
    expect(tree.list[2].value.start_timestamp).toBe(1);
    // @ts-expect-error ignore type guard
    expect(tree.list[3].value.start_timestamp).toBe(2);
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
      })
    );

    expect(tree.list).toHaveLength(3);

    tree.expand(tree.list[1], true);
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
      })
    );

    expect(tree.list).toHaveLength(3);
    tree.expand(tree.list[1], true);
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
      })
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
      })
    );

    tree.expand(tree.list[1], true);

    expect(tree.list[0].isLastChild).toBe(true);
    expect(tree.list[1].isLastChild).toBe(false);
    expect(tree.list[2].isLastChild).toBe(false);
    expect(tree.list[3].isLastChild).toBe(true);
    expect(tree.list[4].isLastChild).toBe(true);
  });

  it('computes connectors', () => {
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            children: [makeTransaction(), makeTransaction()],
          }),
          makeTransaction(),
        ],
      })
    );

    // - node1 []
    // | - child1 [0]
    // | - child2 [0]
    // - node2 []

    tree.expand(tree.list[1], true);
    expect(tree.list.length).toBe(5);

    expect(tree.list[1].connectors.length).toBe(0);
    expect(tree.list[2].connectors.length).toBe(1);
    expect(tree.list[2].connectors[0]).toBe(-1);
    expect(tree.list[3].connectors[0]).toBe(-1);
    expect(tree.list[4].connectors.length).toBe(0);
  });

  describe('expanding', () => {
    it('expands a node and updates the list', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({transactions: [makeTransaction({children: [makeTransaction()]})]})
      );

      const node = tree.list[1];

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
        makeTrace({transactions: [makeTransaction({children: [makeTransaction()]})]})
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
      const lastChildExpandedTxn = makeTransaction({start_timestamp: 1000});
      const lastTransaction = makeTransaction({start_timestamp: 5});
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              children: [
                makeTransaction({children: [lastChildExpandedTxn]}),
                lastTransaction,
              ],
            }),
          ],
        })
      );

      expect(tree.expand(tree.list[1], true)).toBe(true);
      expect(tree.expand(tree.list[2], true)).toBe(true);
      // Assert that the list has been updated
      expect(tree.list).toHaveLength(5);

      expect(tree.expand(tree.list[2], false)).toBe(true);
      expect(tree.list.length).toBe(4);
      expect(tree.expand(tree.list[2], true)).toBe(true);
      expect(tree.list[tree.list.length - 1].value).toBe(lastTransaction);
    });

    it('expanding or collapsing a zoomed in node doesnt do anything', async () => {
      const organization = OrganizationFixture();
      const api = new MockApiClient();

      const tree = TraceTree.FromTrace(
        makeTrace({transactions: [makeTransaction({children: [makeTransaction()]})]})
      );

      const node = tree.list[0];

      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/undefined:undefined/',
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
        })
      );

      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/project:event_id/',
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
        })
      );

      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/project:event_id/',
        method: 'GET',
        body: makeEvent({}, [makeRawSpan()]),
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
      // @ts-expect-error dont care about type guards
      expect(node.children[0].parent.value.transaction).toBe('txn');
      expect(node.children[0].depth).toBe(node.depth + 1);
    });
    it('zooms out', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({project_slug: 'project', event_id: 'event_id'}),
          ],
        })
      );

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/project:event_id/',
        method: 'GET',
        body: makeEvent({}, [makeRawSpan({description: 'span1'})]),
      });
      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        // @ts-expect-error
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
        })
      );

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/project:event_id/',
        method: 'GET',
        body: makeEvent({}, [makeRawSpan({description: 'span1'})]),
      });
      // Zoom in
      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });
      await waitFor(() => {
        // @ts-expect-error
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
        // @ts-expect-error
        expect(tree.list[1].children[0]?.value?.description).toBe('span1');
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
        })
      );

      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/other_project:event_id/',
        method: 'GET',
        body: makeEvent({}, [makeRawSpan({description: 'span1'})]),
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
              children: [
                makeTransaction({project_slug: 'other_project', event_id: 'event_id'}),
              ],
            }),
          ],
        })
      );

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/project:event_id/',
        method: 'GET',
        body: makeEvent({}, [
          makeRawSpan({description: 'span1'}),
          makeRawSpan({description: 'span2'}),
        ]),
      });

      tree.expand(tree.list[1], true);

      expect(tree.list.length).toBe(3);

      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(tree.list.length).toBe(4);
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
      const root = new TraceTreeNode(null, makeRawSpan({description: 'span1'}), {
        project_slug: '',
        event_id: '',
      });

      for (let i = 0; i < 5; i++) {
        root.children.push(
          new TraceTreeNode(root, makeRawSpan({description: 'span', op: 'db'}), {
            project_slug: '',
            event_id: '',
          })
        );
      }

      root.children.push(
        new TraceTreeNode(root, makeRawSpan({description: 'span', op: 'http'}), {
          project_slug: '',
          event_id: '',
        })
      );

      expect(root.children.length).toBe(6);

      TraceTree.AutogroupSiblingSpanNodes(root);

      expect(root.children.length).toBe(2);
    });

    it('autogroups when number of children is exactly 5', () => {
      const root = new TraceTreeNode(null, makeRawSpan({description: 'span1'}), {
        project_slug: '',
        event_id: '',
      });

      for (let i = 0; i < 5; i++) {
        root.children.push(
          new TraceTreeNode(root, makeRawSpan({description: 'span', op: 'db'}), {
            project_slug: '',
            event_id: '',
          })
        );
      }

      expect(root.children.length).toBe(5);

      TraceTree.AutogroupSiblingSpanNodes(root);

      expect(root.children.length).toBe(1);
    });

    it('autogroups when number of children is > 5', () => {
      const root = new TraceTreeNode(null, makeRawSpan({description: 'span1'}), {
        project_slug: '',
        event_id: '',
      });

      for (let i = 0; i < 7; i++) {
        root.children.push(
          new TraceTreeNode(root, makeRawSpan({description: 'span', op: 'db'}), {
            project_slug: '',
            event_id: '',
          })
        );
      }

      expect(root.children.length).toBe(7);

      TraceTree.AutogroupSiblingSpanNodes(root);

      expect(root.children.length).toBe(1);
    });

    it('autogroups children case', () => {
      // span1 : db
      // ---span2 : http
      // ------ span3 : http

      // to

      // span1 : db
      // ---autogrouped(span2) : http
      // ------ span2 : http
      // --------- span3 : http

      const root = new TraceTreeNode(
        null,
        makeRawSpan({description: 'span1', op: 'db'}),
        {
          project_slug: '',
          event_id: '',
        }
      );

      const child = new TraceTreeNode(
        root,
        makeRawSpan({description: 'span2', op: 'http'}),
        {
          project_slug: '',
          event_id: '',
        }
      );
      root.children.push(child);

      const grandChild = new TraceTreeNode(
        child,
        makeRawSpan({description: 'span3', op: 'http'}),
        {
          project_slug: '',
          event_id: '',
        }
      );
      child.children.push(grandChild);

      expect(root.children.length).toBe(1);
      expect(root.children[0].children.length).toBe(1);

      TraceTree.AutogroupDirectChildrenSpanNodes(root);

      expect(root.children.length).toBe(1);

      const autoGroupedNode = root.children[0];
      expect(autoGroupedNode.children.length).toBe(0);

      autoGroupedNode.expanded = true;

      expect((autoGroupedNode.children[0].value as RawSpanType).description).toBe(
        'span2'
      );
    });

    it('autogrouping direct children skips rendering intermediary nodes', () => {
      const root = new TraceTreeNode(
        null,
        makeRawSpan({description: 'span1', op: 'db'}),
        {
          project_slug: '',
          event_id: '',
        }
      );

      const child = new TraceTreeNode(
        root,
        makeRawSpan({description: 'span2', op: 'http'}),
        {
          project_slug: '',
          event_id: '',
        }
      );
      root.children.push(child);

      const grandChild = new TraceTreeNode(
        child,
        makeRawSpan({description: 'span3', op: 'http'}),
        {
          project_slug: '',
          event_id: '',
        }
      );
      child.children.push(grandChild);

      expect(root.children.length).toBe(1);
      expect(root.children[0].children.length).toBe(1);

      TraceTree.AutogroupDirectChildrenSpanNodes(root);

      expect(root.children.length).toBe(1);

      const autoGroupedNode = root.children[0];
      expect(autoGroupedNode.children.length).toBe(0);

      autoGroupedNode.expanded = true;

      expect((autoGroupedNode.children[0].value as RawSpanType).description).toBe(
        'span2'
      );
    });

    it('renders children of autogrouped sibling nodes', async () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: '/',
              project_slug: 'project',
              event_id: 'event_id',
            }),
          ],
        })
      );

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/project:event_id/',
        method: 'GET',
        body: makeEvent({}, [
          makeRawSpan({description: 'parent span', op: 'http', span_id: '1'}),
          makeRawSpan({description: 'span', op: 'db', parent_span_id: '1'}),
          makeRawSpan({description: 'span', op: 'db', parent_span_id: '1'}),
          makeRawSpan({description: 'span', op: 'db', parent_span_id: '1'}),
          makeRawSpan({description: 'span', op: 'db', parent_span_id: '1'}),
          makeRawSpan({description: 'span', op: 'db', parent_span_id: '1'}),
        ]),
      });

      expect(tree.list.length).toBe(2);
      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(tree.list.length).toBe(4);
      });

      // @ts-expect-error
      expect(tree.list[tree.list.length - 1].value.autogrouped_by).toBeTruthy();
      expect(tree.list[tree.list.length - 1].children.length).toBe(5);
      tree.expand(tree.list[tree.list.length - 1], true);
      expect(tree.list.length).toBe(9);
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
        })
      );

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/project:event_id/',
        method: 'GET',
        body: makeEvent({}, [
          makeRawSpan({description: 'parent span', op: 'http', span_id: '1'}),
          makeRawSpan({description: 'span', op: 'db', span_id: '2', parent_span_id: '1'}),
          makeRawSpan({description: 'span', op: 'db', span_id: '3', parent_span_id: '2'}),
          makeRawSpan({description: 'span', op: 'db', span_id: '4', parent_span_id: '3'}),
          makeRawSpan({description: 'span', op: 'db', span_id: '5', parent_span_id: '4'}),
          makeRawSpan({
            description: 'span',
            op: 'redis',
            span_id: '6',
            parent_span_id: '5',
          }),
          makeRawSpan({description: 'span', op: 'https', parent_span_id: '1'}),
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
      // @ts-expect-error dont care about type guards
      expect('autogrouped_by' in autogroupedNode?.value).toBeTruthy();
      // @ts-expect-error dont care about type guards
      expect(autogroupedNode?.groupCount).toBe(4);

      // @ts-expect-error dont care about type guards
      expect(autogroupedNode.head.value.span_id).toBe('2');
      // @ts-expect-error dont care about type guards
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
});

// eslint-disable-next-line
function printTree(tree) {
  const log = tree.list
    .map(t => {
      return (
        ' '.repeat(t.depth) +
        ((t.value?.autogrouped_by?.op && 'autogroup') ||
          t.value.transaction ||
          t.value.op)
      );
    })
    .filter(Boolean)
    .join('\n');

  // eslint-disable-next-line
  console.log(log);
}
