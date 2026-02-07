import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import type {ReplayTrace} from 'sentry/views/replays/detail/trace/useReplayTraces';

import {useTraceMeta} from './useTraceMeta';

jest.mock('sentry/utils/useSyncedLocalStorageState', () => ({
  useSyncedLocalStorageState: jest.fn(),
}));

const organization = OrganizationFixture();

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
  beforeEach(() => {
    jest.mocked(useSyncedLocalStorageState).mockReturnValue(['non-eap', jest.fn()]);
    jest.clearAllMocks();
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
        span_count: 1,
        span_count_map: {
          op1: 1,
        },
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
        span_count: 2,
        span_count_map: {
          op1: 1,
          op2: 1,
        },
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
        span_count: 1,
        span_count_map: {
          op3: 1,
        },
      },
    });

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization,
      initialProps: mockedReplayTraces,
    });

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
        transaction_child_count_map: {
          '1': 1,
          '2': 2,
        },
        span_count: 4,
        span_count_map: {
          op1: 2,
          op2: 1,
          op3: 1,
        },
      },
      errors: [],
      status: 'success',
    });
  });

  it('EAP - Returns merged meta results', async () => {
    const org = OrganizationFixture({
      features: ['trace-spans-format'],
    });

    jest.mocked(useSyncedLocalStorageState).mockReturnValue(['eap', jest.fn()]);

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      body: {
        errors: 1,
        logs: 1,
        performance_issues: 1,
        span_count: 1,
        span_count_map: {
          op1: 1,
        },
        uptime_checks: 0,
        transaction_child_count_map: [{'transaction.id': '1', count: 1}],
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug2/',
      body: {
        errors: 1,
        logs: 1,
        performance_issues: 1,
        span_count: 1,
        span_count_map: {
          op1: 1,
          op2: 1,
        },
        uptime_checks: 0,
        transaction_child_count_map: [{'transaction.id': '2', count: 2}],
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug3/',
      body: {
        errors: 1,
        logs: 1,
        performance_issues: 1,
        span_count: 1,
        span_count_map: {
          op3: 1,
        },
        uptime_checks: 1,
        transaction_child_count_map: [{'transaction.id': '3', count: 1}],
      },
    });

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization: org,
      initialProps: mockedReplayTraces,
    });

    expect(result.current).toEqual({
      data: undefined,
      errors: [],
      status: 'pending',
    });

    await waitFor(() => expect(result.current.status === 'success').toBe(true));

    expect(result.current).toEqual({
      data: {
        errors: 3,
        logs: 3,
        performance_issues: 3,
        span_count: 3,
        span_count_map: {
          op1: 2,
          op2: 1,
          op3: 1,
        },
        transaction_child_count_map: {
          '1': 1,
          '2': 2,
          '3': 1,
        },
        uptime_checks: 0,
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

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization,
      initialProps: mockedReplayTraces,
    });

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
        transaction_child_count_map: {},
        span_count: 0,
        span_count_map: {},
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
        span_count: 1,
        span_count_map: {
          op1: 1,
        },
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
        span_count: 1,
        span_count_map: {
          op2: 1,
        },
      },
    });

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization,
      initialProps: mockedReplayTraces,
    });

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
        transaction_child_count_map: {},
        span_count: 2,
        span_count_map: {
          op1: 1,
          op2: 1,
        },
      },
      errors: [expect.any(Error)],
      status: 'success',
    });

    expect(mockRequest1).toHaveBeenCalledTimes(1);
    expect(mockRequest2).toHaveBeenCalledTimes(1);
    expect(mockRequest3).toHaveBeenCalledTimes(1);
  });
});
