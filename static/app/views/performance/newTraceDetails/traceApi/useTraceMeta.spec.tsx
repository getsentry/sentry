import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useTraceMeta, type TraceMetaTrace} from './useTraceMeta';

const organization = OrganizationFixture();

const mockedTraces: TraceMetaTrace[] = [
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
    jest.clearAllMocks();
  });

  it('returns merged meta results', async () => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      body: {
        errorsCount: 1,
        logsCount: 1,
        metricsCount: 1,
        performanceIssuesCount: 1,
        spansCount: 1,
        spansCountMap: {
          op1: 1,
        },
        transactionChildCountMap: [{'transaction.event_id': '1', 'count()': 1}],
        uptimeCount: 0,
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug2/',
      body: {
        errorsCount: 1,
        logsCount: 1,
        metricsCount: 2,
        performanceIssuesCount: 1,
        spansCount: 1,
        spansCountMap: {
          op1: 1,
          op2: 1,
        },
        transactionChildCountMap: [{'transaction.event_id': '2', 'count()': 2}],
        uptimeCount: 0,
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug3/',
      body: {
        errorsCount: 1,
        logsCount: 1,
        metricsCount: 3,
        performanceIssuesCount: 1,
        spansCount: 1,
        spansCountMap: {
          op3: 1,
        },
        transactionChildCountMap: [{'transaction.event_id': '3', 'count()': 1}],
        uptimeCount: 1,
      },
    });

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization,
      initialProps: mockedTraces,
    });

    expect(result.current).toEqual({
      data: undefined,
      errors: [],
      isLoading: true,
      status: 'pending',
    });

    await waitFor(() => expect(result.current.status === 'success').toBe(true));

    expect(result.current).toEqual({
      data: {
        errorsCount: 3,
        logsCount: 3,
        metricsCount: 6,
        performanceIssuesCount: 3,
        spansCount: 3,
        spansCountMap: {
          op1: 2,
          op2: 1,
          op3: 1,
        },
        transactionChildCountMap: {
          '1': 1,
          '2': 2,
          '3': 1,
        },
        uptimeCount: 1,
      },
      errors: [],
      isLoading: false,
      status: 'success',
    });
    expect(result.current.data?.metricsCount).toBe(6);
  });

  it('accepts trace meta without transactionsCount', async () => {
    const trace = {
      traceSlug: 'slug-without-transactions-count',
      timestamp: 1,
    };

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug-without-transactions-count/',
      body: {
        errorsCount: 0,
        logsCount: 5,
        metricsCount: 1,
        performanceIssuesCount: 0,
        spansCount: 529,
        transactionChildCountMap: [
          {
            'transaction.event_id': '2b6107aa9d5f49c7a100babc02e903a0',
            'count()': 62,
          },
          {'transaction.event_id': null, 'count()': 1},
        ],
        spansCountMap: {
          processor: 113,
        },
        uptimeCount: 0,
      },
    });

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization,
      initialProps: [trace],
    });

    await waitFor(() => expect(result.current.status === 'success').toBe(true));

    expect(result.current.data).toEqual({
      errorsCount: 0,
      logsCount: 5,
      metricsCount: 1,
      performanceIssuesCount: 0,
      spansCount: 529,
      spansCountMap: {
        processor: 113,
      },
      transactionChildCountMap: {
        '2b6107aa9d5f49c7a100babc02e903a0': 62,
      },
      uptimeCount: 0,
    });
  });

  it('Collects errors from rejected api calls', async () => {
    const mockRequest1 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      statusCode: 400,
    });
    const mockRequest2 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug2/',
      statusCode: 400,
    });
    const mockRequest3 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug3/',
      statusCode: 400,
    });

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization,
      initialProps: mockedTraces,
    });

    expect(result.current).toEqual({
      data: undefined,
      errors: [],
      isLoading: true,
      status: 'pending',
    });

    await waitFor(() => expect(result.current.status === 'pending').toBe(false));

    expect(result.current).toEqual({
      data: undefined,
      errors: [expect.any(Error), expect.any(Error), expect.any(Error)],
      isLoading: false,
      status: 'error',
    });

    expect(mockRequest1).toHaveBeenCalled();
    expect(mockRequest2).toHaveBeenCalled();
    expect(mockRequest3).toHaveBeenCalled();
  });

  it('does not return zero-filled metadata when the request fails', async () => {
    const trace = {traceSlug: 'slug1', timestamp: 1};

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      statusCode: 408,
    });

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization,
      initialProps: trace,
    });

    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current).toEqual({
      data: undefined,
      errors: [expect.any(Error)],
      isLoading: false,
      status: 'error',
    });
  });

  it('Retries with 90d when initial 14d response has no data', async () => {
    const tracesWithoutTimestamp: TraceMetaTrace[] = [
      {traceSlug: 'slug1', timestamp: undefined},
      {traceSlug: 'slug2', timestamp: undefined},
    ];

    const emptyBody = {
      errorsCount: 0,
      logsCount: 0,
      metricsCount: 0,
      performanceIssuesCount: 0,
      spansCount: 0,
      spansCountMap: {},
      transactionChildCountMap: [],
      uptimeCount: 0,
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
      errorsCount: 1,
      logsCount: 1,
      metricsCount: 0,
      performanceIssuesCount: 1,
      spansCount: 1,
      spansCountMap: {op1: 1},
      transactionChildCountMap: [{'transaction.event_id': 'tx1', 'count()': 1}],
      uptimeCount: 0,
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
      organization,
      initialProps: tracesWithoutTimestamp,
    });

    await waitFor(() => expect(result.current.status === 'success').toBe(true));

    expect(mockSlug1_14d).toHaveBeenCalledTimes(1);
    expect(mockSlug2_14d).toHaveBeenCalledTimes(1);
    expect(mockSlug1_90d).toHaveBeenCalledTimes(1);
    expect(mockSlug2_90d).toHaveBeenCalledTimes(1);

    expect(result.current.data?.spansCount).toBe(2);
    expect(result.current.data?.errorsCount).toBe(2);
  });

  it.each([
    'errorsCount',
    'logsCount',
    'metricsCount',
    'performanceIssuesCount',
    'spansCount',
    'uptimeCount',
  ] as const)('Does not retry when initial response has only %s', async countField => {
    const emptyBody = {
      errorsCount: 0,
      logsCount: 0,
      metricsCount: 0,
      performanceIssuesCount: 0,
      spansCount: 0,
      spansCountMap: {},
      transactionChildCountMap: [],
      uptimeCount: 0,
    };
    const initialBody = {...emptyBody, [countField]: 1};
    const tracesWithoutTimestamp: TraceMetaTrace[] = [
      {traceSlug: 'slug1', timestamp: undefined},
    ];

    const mockSlug1_14d = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      match: [MockApiClient.matchData({statsPeriod: '14d'})],
      body: initialBody,
    });

    const mockSlug1_90d = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      match: [MockApiClient.matchData({statsPeriod: '90d'})],
      body: emptyBody,
    });

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization,
      initialProps: tracesWithoutTimestamp,
    });

    await waitFor(() => expect(result.current.status === 'success').toBe(true));

    expect(mockSlug1_14d).toHaveBeenCalledTimes(1);
    expect(mockSlug1_90d).not.toHaveBeenCalled();
    expect(result.current.data).toEqual(expect.objectContaining({[countField]: 1}));
  });

  it('Does not retry when all traces have timestamps', async () => {
    const tracesWithTimestamps: TraceMetaTrace[] = [{traceSlug: 'slug1', timestamp: 123}];

    const mockSlug1_timestamp = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      body: {
        errorsCount: 0,
        logsCount: 0,
        metricsCount: 0,
        performanceIssuesCount: 0,
        spansCount: 0,
        spansCountMap: {},
        transactionChildCountMap: [],
        uptimeCount: 0,
      },
    });

    const mockSlug1_90d = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      match: [MockApiClient.matchData({statsPeriod: '90d'})],
      body: {
        errorsCount: 1,
        logsCount: 1,
        metricsCount: 0,
        performanceIssuesCount: 1,
        spansCount: 1,
        spansCountMap: {},
        transactionChildCountMap: [],
        uptimeCount: 0,
      },
    });

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization,
      initialProps: tracesWithTimestamps,
    });

    await waitFor(() => expect(result.current.status === 'success').toBe(true));

    expect(mockSlug1_timestamp).toHaveBeenCalledTimes(1);
    expect(mockSlug1_90d).not.toHaveBeenCalled();
    expect(result.current.data?.spansCount).toBe(0);
  });

  it('Accumulates metaResults and collects errors from rejected api calls', async () => {
    const mockRequest1 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug1/',
      statusCode: 400,
    });
    const mockRequest2 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug2/',
      body: {
        errorsCount: 1,
        logsCount: 1,
        metricsCount: 1,
        performanceIssuesCount: 1,
        spansCount: 1,
        spansCountMap: {
          op1: 1,
        },
        transactionChildCountMap: [],
        uptimeCount: 0,
      },
    });
    const mockRequest3 = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/slug3/',
      body: {
        errorsCount: 1,
        logsCount: 1,
        metricsCount: 1,
        performanceIssuesCount: 1,
        spansCount: 1,
        spansCountMap: {
          op2: 1,
        },
        transactionChildCountMap: [],
        uptimeCount: 0,
      },
    });

    const {result} = renderHookWithProviders(useTraceMeta, {
      organization,
      initialProps: mockedTraces,
    });

    expect(result.current).toEqual({
      data: undefined,
      errors: [],
      isLoading: true,
      status: 'pending',
    });

    await waitFor(() => expect(result.current.status === 'pending').toBe(false));

    expect(result.current).toEqual({
      data: {
        errorsCount: 2,
        logsCount: 2,
        metricsCount: 2,
        performanceIssuesCount: 2,
        spansCount: 2,
        spansCountMap: {
          op1: 1,
          op2: 1,
        },
        transactionChildCountMap: {},
        uptimeCount: 0,
      },
      errors: [expect.any(Error)],
      isLoading: false,
      status: 'success',
    });

    expect(mockRequest1).toHaveBeenCalledTimes(1);
    expect(mockRequest2).toHaveBeenCalledTimes(1);
    expect(mockRequest3).toHaveBeenCalledTimes(1);
  });
});
