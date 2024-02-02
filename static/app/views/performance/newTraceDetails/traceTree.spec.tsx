import {OrganizationFixture} from 'sentry-fixture/organization';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {EntryType, type Event} from 'sentry/types';
import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';

import {TraceTree} from './traceTree';

const makeTransaction = (
  overrides: Partial<TraceFullDetailed> = {}
): TraceFullDetailed => {
  return {
    children: [],
    start_timestamp: 0,
    timestamp: 1,
    'transaction.op': '',
    'transaction.status': '',
    ...overrides,
  } as TraceFullDetailed;
};

const makeRawSpan = (overrides: Partial<RawSpanType> = {}): RawSpanType => {
  return {
    op: '',
    description: '',
    start_timestamp: 0,
    timestamp: 1,
    ...overrides,
  } as RawSpanType;
};

const makeEvent = (overrides: Partial<Event> = {}, spans: RawSpanType[] = []): Event => {
  return {
    entries: [{type: EntryType.SPANS, data: spans}],
    ...overrides,
  } as Event;
};

describe('TraceTree', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });
  it('builds from transactions', () => {
    const tree = TraceTree.FromTrace([
      makeTransaction({
        children: [],
      }),
      makeTransaction({
        children: [],
      }),
    ]);

    expect(tree.list).toHaveLength(2);
  });

  it('establishes parent-child relationships', () => {
    const tree = TraceTree.FromTrace([
      makeTransaction({
        children: [makeTransaction()],
      }),
    ]);

    expect(tree.root.children).toHaveLength(1);
    expect(tree.root.children[0].children).toHaveLength(1);
  });

  describe('expanding', () => {
    it('expands a node and updates the list', () => {
      const tree = TraceTree.FromTrace([
        makeTransaction({children: [makeTransaction()]}),
      ]);
      const node = tree.list[0];

      expect(tree.list.length).toBe(1);
      expect(node.expanded).toBe(false);
      expect(tree.expand(node, true)).toBe(true);
      expect(node.expanded).toBe(true);
      // Assert that the list has been updated
      expect(tree.list).toHaveLength(2);
      expect(tree.list[1]).toBe(node.children[0]);
    });

    it('collapses a node and updates the list', () => {
      const tree = TraceTree.FromTrace([
        makeTransaction({children: [makeTransaction()]}),
      ]);
      const node = tree.list[0];

      tree.expand(node, true);
      expect(tree.list.length).toBe(2);
      expect(tree.expand(node, false)).toBe(true);
      expect(node.expanded).toBe(false);
      // Assert that the list has been updated
      expect(tree.list).toHaveLength(1);
      expect(tree.list[0]).toBe(node);
    });
  });

  describe('zooming', () => {
    it('marks node as zoomed in', async () => {
      const organization = OrganizationFixture();
      const api = new MockApiClient();

      const tree = TraceTree.FromTrace([
        makeTransaction({project_slug: 'project', event_id: 'event_id'}),
      ]);

      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/project:event_id/',
        method: 'GET',
        body: makeEvent(),
      });
      const node = tree.list[0];

      expect(node.zoomedIn).toBe(false);
      tree.zoomIn(node, true, {api, organization});

      await waitFor(() => {
        expect(node.zoomedIn).toBe(true);
      });

      expect(request).toHaveBeenCalled();
    });
    it('fetches spans for node when zooming in', async () => {
      const tree = TraceTree.FromTrace([
        makeTransaction({project_slug: 'project', event_id: 'event_id'}),
      ]);

      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/project:event_id/',
        method: 'GET',
        body: makeEvent({}, [makeRawSpan()]),
      });

      const node = tree.list[0];
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
      expect(node.children[0].depth).toBe(node.depth + 1);
    });
    it('zooms out', async () => {
      const tree = TraceTree.FromTrace([
        makeTransaction({project_slug: 'project', event_id: 'event_id'}),
      ]);

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/project:event_id/',
        method: 'GET',
        body: makeEvent({}, [makeRawSpan({description: 'span1'})]),
      });
      tree.zoomIn(tree.list[0], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        // @ts-expect-error
        expect(tree.list[0].children[0].value.description).toBe('span1');
      });

      tree.zoomIn(tree.list[0], false, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        // Assert child no longer points to children
        expect(tree.list[0].zoomedIn).toBe(false);
        expect(tree.list[0].children[0]).toBe(undefined);
        expect(tree.list[1]).toBe(undefined);
      });
    });

    it('zooms in and out', async () => {
      const tree = TraceTree.FromTrace([
        makeTransaction({project_slug: 'project', event_id: 'event_id'}),
      ]);

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/project:event_id/',
        method: 'GET',
        body: makeEvent({}, [makeRawSpan({description: 'span1'})]),
      });
      // Zoom in
      tree.zoomIn(tree.list[0], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });
      await waitFor(() => {
        // @ts-expect-error
        expect(tree.list[0].children[0].value.description).toBe('span1');
      });
      // Zoom out
      tree.zoomIn(tree.list[0], false, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });
      await waitFor(() => {
        expect(tree.list[1]).toBe(undefined);
      });
      // Zoom in
      tree.zoomIn(tree.list[0], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });
      await waitFor(() => {
        // @ts-expect-error
        expect(tree.list[0].children[0]?.value?.description).toBe('span1');
      });
    });
    it('zooms in and out preserving siblings', async () => {
      const tree = TraceTree.FromTrace([
        makeTransaction({
          project_slug: 'project',
          event_id: 'event_id',
          start_timestamp: 0,
          children: [
            makeTransaction({start_timestamp: 2, timestamp: 3}),
            makeTransaction({
              start_timestamp: 1,
              timestamp: 2,
              project_slug: 'other_project',
              event_id: 'event_id',
            }),
          ],
        }),
      ]);

      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/other_project:event_id/',
        method: 'GET',
        body: makeEvent({}, [makeRawSpan({description: 'span1'})]),
      });
      tree.expand(tree.list[0], true);
      tree.zoomIn(tree.list[1], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      expect(request).toHaveBeenCalled();

      // Zoom in
      await waitFor(() => {
        expect(tree.list.length).toBe(4);
      });

      // Zoom out
      tree.zoomIn(tree.list[1], false, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(tree.list.length).toBe(3);
      });
    });
    it('preserves expanded state when zooming in and out', async () => {
      const tree = TraceTree.FromTrace([
        makeTransaction({
          project_slug: 'project',
          event_id: 'event_id',
          children: [
            makeTransaction({project_slug: 'other_project', event_id: 'event_id'}),
          ],
        }),
      ]);

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/project:event_id/',
        method: 'GET',
        body: makeEvent({}, [
          makeRawSpan({description: 'span1'}),
          makeRawSpan({description: 'span2'}),
        ]),
      });

      tree.expand(tree.list[0], true);

      expect(tree.list.length).toBe(2);

      tree.zoomIn(tree.list[0], true, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(tree.list.length).toBe(3);
      });

      tree.zoomIn(tree.list[0], false, {
        api: new MockApiClient(),
        organization: OrganizationFixture(),
      });

      await waitFor(() => {
        expect(tree.list.length).toBe(2);
      });
      expect(tree.list[0].expanded).toBe(true);
    });
  });
});
