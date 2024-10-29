import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import * as useOrganization from 'sentry/utils/useOrganization';
import type {ReplayTrace} from 'sentry/views/replays/detail/trace/useReplayTraces';

import {useTraceMeta} from './useTraceMeta';

const organization = OrganizationFixture();
const queryClient = makeTestQueryClient();

const mockedReplayTraces: ReplayTrace[] = [
  {
    traceSlug: 'slug1',
    timestamp: 1,
  },
  {
    traceSlug: 'slug2',
    timestamp: 2,
  },
  {
    traceSlug: 'slug3',
    timestamp: 3,
  },
];

describe('useTraceMeta', () => {
  beforeEach(function () {
    queryClient.clear();
    jest.clearAllMocks();
    jest.spyOn(useOrganization, 'default').mockReturnValue(organization);
  });

  it('Returns merged meta results', async () => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trace-meta/slug1/',
      body: {
        errors: 1,
        performance_issues: 1,
        projects: 1,
        transactions: 1,
        transaction_child_count_map: [{'transaction.id': '1', count: 1}],
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trace-meta/slug2/',
      body: {
        errors: 1,
        performance_issues: 1,
        projects: 1,
        transactions: 1,
        transaction_child_count_map: [{'transaction.id': '2', count: 2}],
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trace-meta/slug3/',
      body: {
        errors: 1,
        performance_issues: 1,
        projects: 1,
        transactions: 1,
        transaction_child_count_map: [],
      },
    });

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const {result} = renderHook(() => useTraceMeta(mockedReplayTraces), {wrapper});

    expect(result.current).toEqual({
      data: undefined,
      errors: [],
      status: 'pending',
    });

    await waitFor(() => expect(result.current.status === 'success').toBe(true));

    expect(result.current).toEqual({
      data: {
        errors: 3,
        performance_issues: 3,
        projects: 1,
        transactions: 3,
        transactiontoSpanChildrenCount: {
          '1': 1,
          '2': 2,
        },
      },
      errors: [],
      status: 'success',
    });
  });

  it('Collects errors from rejected api calls', async () => {
    const mockRequest1 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trace-meta/slug1/',
      statusCode: 400,
    });
    const mockRequest2 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trace-meta/slug2/',
      statusCode: 400,
    });
    const mockRequest3 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trace-meta/slug3/',
      statusCode: 400,
    });

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const {result} = renderHook(() => useTraceMeta(mockedReplayTraces), {wrapper});

    expect(result.current).toEqual({
      data: undefined,
      errors: [],
      status: 'pending',
    });

    await waitFor(() => expect(result.current.status === 'pending').toBe(false));

    expect(result.current).toEqual({
      data: {
        errors: 0,
        performance_issues: 0,
        projects: 0,
        transactions: 0,
        transactiontoSpanChildrenCount: {},
      },
      errors: [expect.any(Error), expect.any(Error), expect.any(Error)],
      status: 'error',
    });

    expect(mockRequest1).toHaveBeenCalled();
    expect(mockRequest2).toHaveBeenCalled();
    expect(mockRequest3).toHaveBeenCalled();
  });

  it('Accumulates metaResults and collects errors from rejected api calls', async () => {
    const mockRequest1 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trace-meta/slug1/',
      statusCode: 400,
    });
    const mockRequest2 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trace-meta/slug2/',
      body: {
        errors: 1,
        performance_issues: 1,
        projects: 1,
        transactions: 1,
        transaction_child_count_map: [],
      },
    });
    const mockRequest3 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trace-meta/slug3/',
      body: {
        errors: 1,
        performance_issues: 1,
        projects: 1,
        transactions: 1,
        transaction_child_count_map: [],
      },
    });

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const {result} = renderHook(() => useTraceMeta(mockedReplayTraces), {wrapper});

    expect(result.current).toEqual({
      data: undefined,
      errors: [],
      status: 'pending',
    });

    await waitFor(() => expect(result.current.status === 'pending').toBe(false));

    expect(result.current).toEqual({
      data: {
        errors: 2,
        performance_issues: 2,
        projects: 1,
        transactions: 2,
        transactiontoSpanChildrenCount: {},
      },
      errors: [expect.any(Error)],
      status: 'success',
    });

    expect(mockRequest1).toHaveBeenCalledTimes(1);
    expect(mockRequest2).toHaveBeenCalledTimes(1);
    expect(mockRequest3).toHaveBeenCalledTimes(1);
  });
});
