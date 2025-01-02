import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import * as useOrganization from 'sentry/utils/useOrganization';

import {TraceTree} from './traceTree';
import {makeTrace, makeTransaction} from './traceTreeTestUtils';

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
      {replay: null, meta: null}
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

    tree.build();
    expect(tree.list.length).toBe(3);

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
      {replay: null, meta: null}
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

    tree.build();
    expect(tree.list.length).toBe(3);

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

    expect(tree.list.length).toBe(7);
    expect(mockedResponse1).toHaveBeenCalledTimes(1);
    expect(mockedResponse2).toHaveBeenCalledTimes(1);
    expect(mockedResponse3).toHaveBeenCalledTimes(1);
  });
});
