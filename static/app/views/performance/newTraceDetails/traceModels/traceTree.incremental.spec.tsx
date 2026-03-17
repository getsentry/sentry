import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import {TraceTree} from './traceTree';
import {
  makeEAPSpan,
  makeEAPTrace,
  makeTrace,
  makeTransaction,
} from './traceTreeTestUtils';

describe('incremental trace fetch', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Fetches and updates tree with fetched trace', async () => {
    const traces = [
      {traceSlug: 'slug1', timestamp: 1},
      {traceSlug: 'slug2', timestamp: 2},
    ];

    const tree = TraceTree.FromTrace(
      makeEAPTrace([
        makeEAPSpan({
          event_id: 'txn-1',
          op: 'txn 1',
          start_timestamp: 0,
          end_timestamp: 1,
          children: [
            makeEAPSpan({
              event_id: 'txn-2',
              start_timestamp: 1,
              end_timestamp: 2,
              op: 'txn 2',
              parent_span_id: 'txn-1',
            }),
          ],
        }),
      ]),
      {replay: null, meta: null, organization}
    );

    // Mock the API calls
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace/slug1/?include_uptime=1&limit=10000&timestamp=1',
      body: makeEAPTrace([
        makeEAPSpan({
          event_id: 'txn-3',
          op: 'txn 3',
          start_timestamp: 0,
          end_timestamp: 1,
          children: [
            makeEAPSpan({
              event_id: 'txn-4',
              start_timestamp: 1,
              end_timestamp: 2,
              op: 'txn 4',
              parent_span_id: 'txn-3',
            }),
          ],
        }),
      ]),
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace/slug2/?include_uptime=1&limit=10000&timestamp=2',
      body: makeEAPTrace([
        makeEAPSpan({
          event_id: 'txn-5',
          op: 'txn 5',
          start_timestamp: 0,
          end_timestamp: 1,
          children: [
            makeEAPSpan({
              event_id: 'txn-6',
              start_timestamp: 1,
              end_timestamp: 2,
              op: 'txn 6',
              parent_span_id: 'txn-5',
            }),
          ],
        }),
      ]),
    });

    tree.build();
    // 1 root trace node + 2 eap spans
    expect(tree.list).toHaveLength(3);

    tree.fetchAdditionalTraces({
      replayTraces: traces,
      api: new MockApiClient(),
      filters: {},
      organization,
      rerender: () => {},
      urlParams: {} as Location['query'],

      meta: null,
    });

    await waitFor(() => expect(tree.root.children[0]!.fetchStatus).toBe('idle'));

    // 1 root trace node + 2 eap spans + 4 newly fetched eap spans
    expect(tree.list).toHaveLength(7);
  });

  it('Does not infinitely fetch on error', async () => {
    const traces = [
      {traceSlug: 'slug1', timestamp: 1},
      {traceSlug: 'slug2', timestamp: 2},
      {traceSlug: 'slug3', timestamp: 3},
    ];

    const tree = TraceTree.FromTrace(
      makeEAPTrace([
        makeEAPSpan({
          event_id: 'txn-1',
          op: 'txn 1',
          start_timestamp: 0,
          end_timestamp: 1,
          children: [
            makeEAPSpan({
              event_id: 'txn-2',
              start_timestamp: 1,
              end_timestamp: 2,
              op: 'txn 2',
              parent_span_id: 'txn-1',
            }),
          ],
        }),
      ]),
      {replay: null, meta: null, organization}
    );

    // Mock the API calls
    const mockedResponse1 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace/slug1/?include_uptime=1&limit=10000&timestamp=1',
      statusCode: 400,
    });
    const mockedResponse2 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace/slug2/?include_uptime=1&limit=10000&timestamp=2',
      body: makeEAPTrace([
        makeEAPSpan({
          event_id: 'txn-5',
          op: 'txn 5',
          start_timestamp: 0,
          end_timestamp: 1,
          children: [
            makeEAPSpan({
              event_id: 'txn-6',
              start_timestamp: 1,
              end_timestamp: 2,
              op: 'txn 6',
              parent_span_id: 'txn-5',
            }),
          ],
        }),
      ]),
    });
    const mockedResponse3 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace/slug3/?include_uptime=1&limit=10000&timestamp=3',
      body: makeEAPTrace([
        makeEAPSpan({
          event_id: 'txn-7',
          op: 'txn 7',
          start_timestamp: 0,
          end_timestamp: 1,
          children: [
            makeEAPSpan({
              event_id: 'txn-8',
              start_timestamp: 1,
              end_timestamp: 2,
              op: 'txn 8',
              parent_span_id: 'txn-7',
            }),
          ],
        }),
      ]),
    });

    tree.build();
    // 1 root trace node + 2 eap spans
    expect(tree.list).toHaveLength(3);

    tree.fetchAdditionalTraces({
      replayTraces: traces,
      api: new MockApiClient(),
      filters: {},
      organization,
      rerender: () => {},
      urlParams: {} as Location['query'],

      meta: null,
    });

    await waitFor(() => expect(tree.root.children[0]!.fetchStatus).toBe('idle'));
    tree.build();

    // 1 root trace node + 2 eap spans + 4 newly fetched eap spans
    expect(tree.list).toHaveLength(7);
    expect(mockedResponse1).toHaveBeenCalledTimes(1);
    expect(mockedResponse2).toHaveBeenCalledTimes(1);
    expect(mockedResponse3).toHaveBeenCalledTimes(1);
  });

  it('EAP -Fetches and updates tree with fetched trace', async () => {
    const traces = [
      {traceSlug: 'slug1', timestamp: 1},
      {traceSlug: 'slug2', timestamp: 2},
    ];

    const tree = TraceTree.FromTrace(
      makeEAPTrace([
        makeEAPSpan({
          event_id: '1',
          start_timestamp: 0,
          end_timestamp: 1,
          op: 'op1',
          children: [
            makeEAPSpan({
              event_id: '2',
              start_timestamp: 1,
              parent_span_id: '1',
              end_timestamp: 2,
              op: 'op2',
            }),
          ],
        }),
      ]),
      {replay: null, meta: null, organization}
    );

    // Mock the API calls
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace/slug1/?include_uptime=1&limit=10000&timestamp=1',
      body: makeEAPTrace([
        makeEAPSpan({
          event_id: '3',
          start_timestamp: 0,
          end_timestamp: 1,
          op: 'op3',
          children: [
            makeEAPSpan({
              event_id: '4',
              start_timestamp: 1,
              parent_span_id: '3',
              end_timestamp: 2,
              op: 'op4',
            }),
          ],
        }),
      ]),
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace/slug2/?include_uptime=1&limit=10000&timestamp=2',
      body: makeEAPTrace([
        makeEAPSpan({
          event_id: '5',
          start_timestamp: 0,
          end_timestamp: 1,
          op: 'op5',
        }),
      ]),
    });

    tree.build();

    // 1 root trace node + 2 eap spans
    expect(tree.list).toHaveLength(3);

    tree.fetchAdditionalTraces({
      replayTraces: traces,
      api: new MockApiClient(),
      filters: {},
      organization,
      rerender: () => {},
      urlParams: {} as Location['query'],

      meta: null,
    });

    await waitFor(() => expect(tree.root.children[0]!.fetchStatus).toBe('idle'));

    // 1 root trace node + 2 eap spans + 3 newly fetched eap spans
    expect(tree.list).toHaveLength(6);
  });

  it('EAP - Does not infinitely fetch on error', async () => {
    const traces = [
      {traceSlug: 'slug1', timestamp: 1},
      {traceSlug: 'slug2', timestamp: 2},
      {traceSlug: 'slug3', timestamp: 3},
    ];

    const tree = TraceTree.FromTrace(
      makeEAPTrace([
        makeEAPSpan({
          event_id: '1',
          start_timestamp: 0,
          end_timestamp: 1,
          op: 'op1',
          children: [
            makeEAPSpan({
              event_id: '2',
              start_timestamp: 1,
              parent_span_id: '1',
              end_timestamp: 2,
              op: 'op2',
            }),
          ],
        }),
      ]),
      {replay: null, meta: null, organization}
    );

    // Mock the API calls
    const mockedResponse1 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace/slug1/?include_uptime=1&limit=10000&timestamp=1',
      statusCode: 400,
    });
    const mockedResponse2 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace/slug2/?include_uptime=1&limit=10000&timestamp=2',
      body: makeEAPTrace([
        makeEAPSpan({
          event_id: '5',
          start_timestamp: 0,
          end_timestamp: 1,
          op: 'op5',
        }),
      ]),
    });
    const mockedResponse3 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace/slug3/?include_uptime=1&limit=10000&timestamp=3',
      body: makeEAPTrace([
        makeEAPSpan({
          event_id: '7',
          start_timestamp: 0,
          end_timestamp: 1,
          op: 'op7',
        }),
      ]),
    });

    tree.build();
    // 1 root trace node + 2 eap spans
    expect(tree.list).toHaveLength(3);

    tree.fetchAdditionalTraces({
      replayTraces: traces,
      api: new MockApiClient(),
      filters: {},
      organization,
      rerender: () => {},
      urlParams: {} as Location['query'],

      meta: null,
    });

    await waitFor(() => expect(tree.root.children[0]!.fetchStatus).toBe('idle'));
    tree.build();

    // 1 root trace node + 2 eap spans + 2 newly fetched eap spans
    expect(tree.list).toHaveLength(5);
    expect(mockedResponse1).toHaveBeenCalledTimes(1);
    expect(mockedResponse2).toHaveBeenCalledTimes(1);
    expect(mockedResponse3).toHaveBeenCalledTimes(1);
  });
});
