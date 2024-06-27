import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {TraceSplitResults} from 'sentry/utils/performance/quickTrace/types';
import * as useOrganization from 'sentry/utils/useOrganization';

import {TraceTree} from '../traceModels/traceTree';

import {useIncrementalTraces} from './useIncrementalTraces';

const organization = OrganizationFixture();

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

describe('useTraceMeta', () => {
  beforeEach(function () {
    jest.clearAllMocks();
    jest.spyOn(useOrganization, 'default').mockReturnValue(organization);
  });

  it('Fetches and updates tree with fetched trace', async () => {
    const traceDataRows = [
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
      null
    );

    // Mock the API calls
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trace/slug2/?limit=10000&timestamp=2&useSpans=1',
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

    const {result} = renderHook(() => useIncrementalTraces(tree, traceDataRows));

    expect(result.current).toEqual({
      errors: [],
      isIncrementallyFetching: true,
    });

    await waitFor(() => expect(result.current.isIncrementallyFetching).toBe(false));

    expect(result.current).toEqual({
      errors: [],
      isIncrementallyFetching: false,
    });
    expect(tree.list.length).toBe(5);
  });

  it('Does not infinitely fetch on error', async () => {
    const traceDataRows = [
      {traceSlug: 'slug1', timestamp: 1},
      {traceSlug: 'slug2', timestamp: 2},
      {traceSlug: 'slug3', timestamp: 3},
      {traceSlug: 'slug4', timestamp: 4},
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
      null
    );

    // Mock the API calls
    const mockedResponse1 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trace/slug2/?limit=10000&timestamp=2&useSpans=1',
      statusCode: 400,
    });
    const mockedResponse2 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trace/slug3/?limit=10000&timestamp=3&useSpans=1',
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
      url: '/organizations/org-slug/events-trace/slug4/?limit=10000&timestamp=4&useSpans=1',
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

    const {result} = renderHook(() => useIncrementalTraces(tree, traceDataRows));

    expect(result.current).toEqual({
      errors: [],
      isIncrementallyFetching: true,
    });

    await waitFor(() => expect(result.current.isIncrementallyFetching).toBe(false));

    expect(result.current).toEqual({
      errors: [expect.any(Error)],
      isIncrementallyFetching: false,
    });
    expect(tree.list.length).toBe(7);
    expect(mockedResponse1).toHaveBeenCalledTimes(1);
    expect(mockedResponse2).toHaveBeenCalledTimes(1);
    expect(mockedResponse3).toHaveBeenCalledTimes(1);
  });
});
