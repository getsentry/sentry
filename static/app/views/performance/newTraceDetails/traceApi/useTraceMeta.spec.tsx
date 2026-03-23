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

    const {result} = renderHookWithProviders(() => useTraceMeta(mockedReplayTraces), {
      organization,
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

    const {result} = renderHookWithProviders(() => useTraceMeta(mockedReplayTraces), {
      organization: org,
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

    const {result} = renderHookWithProviders(() => useTraceMeta(mockedReplayTraces), {
      organization,
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

  it('Retries with 90d when initial 14d response has no data', async () => {
    const org = OrganizationFixture({features: ['trace-spans-format']});
    const tracesWithoutTimestamp: ReplayTrace[] = [
      {traceSlug: 'slug1', timestamp: undefined},
      {traceSlug: 'slug2', timestamp: undefined},
    ];

    const emptyBody = {
      errors: 0,
      logs: 0,
      performance_issues: 0,
      span_count: 0,
      span_count_map: {},
      transaction_child_count_map: [],
      uptime_checks: 0,
    };

    const mockSlug1_14d = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      match: [MockApiClient.matchData({statsPeriod: '14d'})],
      body: emptyBody,
    });
    const mockSlug2_14d = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug2/',
      match: [MockApiClient.matchData({statsPeriod: '14d'})],
      body: emptyBody,
    });

    const realBody = {
      errors: 1,
      logs: 1,
      performance_issues: 1,
      span_count: 1,
      span_count_map: {op1: 1},
      transaction_child_count_map: [{'transaction.id': 'tx1', count: 1}],
      uptime_checks: 0,
    };

    const mockSlug1_90d = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      match: [MockApiClient.matchData({statsPeriod: '90d'})],
      body: realBody,
    });
    const mockSlug2_90d = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug2/',
      match: [MockApiClient.matchData({statsPeriod: '90d'})],
      body: realBody,
    });

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization: org,
      initialProps: tracesWithoutTimestamp,
    });

    await waitFor(() => expect(result.current.status === 'success').toBe(true));

    expect(mockSlug1_14d).toHaveBeenCalledTimes(1);
    expect(mockSlug2_14d).toHaveBeenCalledTimes(1);
    expect(mockSlug1_90d).toHaveBeenCalledTimes(1);
    expect(mockSlug2_90d).toHaveBeenCalledTimes(1);

    expect(result.current.data?.span_count).toBe(2);
    expect(result.current.data?.errors).toBe(2);
  });

  it('Does not retry when initial response has data', async () => {
    const org = OrganizationFixture({features: ['trace-spans-format']});
    const tracesWithoutTimestamp: ReplayTrace[] = [
      {traceSlug: 'slug1', timestamp: undefined},
    ];

    const mockSlug1_14d = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      match: [MockApiClient.matchData({statsPeriod: '14d'})],
      body: {
        errors: 1,
        logs: 1,
        performance_issues: 1,
        span_count: 1,
        span_count_map: {op1: 1},
        transaction_child_count_map: [],
        uptime_checks: 0,
      },
    });

    const mockSlug1_90d = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      match: [MockApiClient.matchData({statsPeriod: '90d'})],
      body: {
        errors: 2,
        logs: 2,
        performance_issues: 2,
        span_count: 2,
        span_count_map: {},
        transaction_child_count_map: [],
        uptime_checks: 0,
      },
    });

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization: org,
      initialProps: tracesWithoutTimestamp,
    });

    await waitFor(() => expect(result.current.status === 'success').toBe(true));

    expect(mockSlug1_14d).toHaveBeenCalledTimes(1);
    expect(mockSlug1_90d).not.toHaveBeenCalled();
    expect(result.current.data?.span_count).toBe(1);
  });

  it('Does not retry when all traces have timestamps', async () => {
    const org = OrganizationFixture({features: ['trace-spans-format']});
    const tracesWithTimestamps: ReplayTrace[] = [{traceSlug: 'slug1', timestamp: 123}];

    const mockSlug1_timestamp = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      body: {
        errors: 0,
        logs: 0,
        performance_issues: 0,
        span_count: 0,
        span_count_map: {},
        transaction_child_count_map: [],
        uptime_checks: 0,
      },
    });

    const mockSlug1_90d = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      match: [MockApiClient.matchData({statsPeriod: '90d'})],
      body: {
        errors: 1,
        logs: 1,
        performance_issues: 1,
        span_count: 1,
        span_count_map: {},
        transaction_child_count_map: [],
        uptime_checks: 0,
      },
    });

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization: org,
      initialProps: tracesWithTimestamps,
    });

    await waitFor(() => expect(result.current.status === 'success').toBe(true));

    expect(mockSlug1_timestamp).toHaveBeenCalledTimes(1);
    expect(mockSlug1_90d).not.toHaveBeenCalled();
    expect(result.current.data?.span_count).toBe(0);
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

    const {result} = renderHookWithProviders(() => useTraceMeta(mockedReplayTraces), {
      organization,
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
