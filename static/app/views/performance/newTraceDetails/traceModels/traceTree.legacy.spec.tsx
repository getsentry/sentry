import {OrganizationFixture} from 'sentry-fixture/organization';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import {TraceTree} from '../traceModels/traceTree';

const EVENT_REQUEST_URL =
  '/organizations/org-slug/events/project:event_id/?averageColumn=span.self_time&averageColumn=span.duration';

import {
  assertParentAutogroupedNode,
  assertSpanNode,
  assertTransactionNode,
  makeEventTransaction,
  makeSpan,
  makeTrace,
  makeTransaction,
} from './traceTreeTestUtils';

describe('TraceTree', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
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
});
