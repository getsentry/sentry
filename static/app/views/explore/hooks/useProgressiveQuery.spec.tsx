import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  QUERY_MODE,
  SAMPLING_MODE,
  type SamplingMode,
  useProgressiveQuery,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/usePageFilters');

function useMockHookImpl({
  enabled,
  query,
  queryExtras,
}: {
  enabled: boolean;
  query: string;
  queryExtras: {samplingMode: SamplingMode};
}) {
  const api = useApi();
  const result = useQuery({
    queryKey: ['/test', {query: {samplingMode: queryExtras?.samplingMode, query}}],
    queryFn: () =>
      api.requestPromise('/test', {
        query: {samplingMode: queryExtras?.samplingMode, query},
      }),
    enabled,
  });

  return {
    result,
  };
}

function createWrapper(org: Organization) {
  return function TestWrapper({children}: {children: React.ReactNode}) {
    const queryClient = makeTestQueryClient();
    return (
      <QueryClientProvider client={queryClient}>
        <OrganizationContext value={org}>{children}</OrganizationContext>
      </QueryClientProvider>
    );
  };
}

describe('useProgressiveQuery', function () {
  let mockRequestUrl: jest.Mock;
  beforeEach(function () {
    mockRequestUrl = MockApiClient.addMockResponse({
      url: '/test',
      body: 'test',
    });

    jest.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '14d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [2],
      },
    });
  });

  it('makes a single request when the feature flag is disabled', function () {
    renderHook(
      () =>
        useProgressiveQuery({
          queryHookImplementation: useMockHookImpl,
          queryHookArgs: {enabled: true},
        }),
      {wrapper: createWrapper(OrganizationFixture())}
    );

    expect(mockRequestUrl).toHaveBeenCalledTimes(1);
    expect(mockRequestUrl).toHaveBeenCalledWith(
      '/test',
      expect.objectContaining({
        query: {
          samplingMode: undefined,
        },
      })
    );
  });

  it('only queries the preflight and best effort once each in parallel mode', function () {
    renderHook(
      () =>
        useProgressiveQuery({
          queryHookImplementation: useMockHookImpl,
          queryHookArgs: {enabled: true, query: 'test value'},
          queryOptions: {queryMode: QUERY_MODE.PARALLEL},
        }),
      {
        wrapper: createWrapper(
          OrganizationFixture({
            features: ['visibility-explore-progressive-loading'],
          })
        ),
      }
    );

    // Test that the only change was to the sampling mode between requests
    expect(mockRequestUrl).toHaveBeenNthCalledWith(
      1,
      '/test',
      expect.objectContaining({
        query: {samplingMode: SAMPLING_MODE.PREFLIGHT, query: 'test value'},
      })
    );
    expect(mockRequestUrl).toHaveBeenNthCalledWith(
      2,
      '/test',
      expect.objectContaining({
        query: {samplingMode: SAMPLING_MODE.BEST_EFFORT, query: 'test value'},
      })
    );
  });

  it('can call the preflight and best effort requests serially', async function () {
    renderHook(
      () =>
        useProgressiveQuery({
          queryHookImplementation: useMockHookImpl,
          queryHookArgs: {enabled: true, query: 'test value'},
          queryOptions: {queryMode: QUERY_MODE.SERIAL},
        }),
      {
        wrapper: createWrapper(
          OrganizationFixture({
            features: ['visibility-explore-progressive-loading'],
          })
        ),
      }
    );

    // Test that the only change was to the sampling mode between requests
    expect(mockRequestUrl).toHaveBeenCalledTimes(1);
    expect(mockRequestUrl).toHaveBeenNthCalledWith(
      1,
      '/test',
      expect.objectContaining({
        query: {samplingMode: SAMPLING_MODE.PREFLIGHT, query: 'test value'},
      })
    );

    await waitFor(() => {
      expect(mockRequestUrl).toHaveBeenCalledTimes(2);
    });
    expect(mockRequestUrl).toHaveBeenNthCalledWith(
      2,
      '/test',
      expect.objectContaining({
        query: {samplingMode: SAMPLING_MODE.BEST_EFFORT, query: 'test value'},
      })
    );
  });

  it('does not trigger the best effort request if we withold best effort data and there is preflight data', function () {
    mockRequestUrl = MockApiClient.addMockResponse({
      url: '/test',
      body: ['has', 'data'],
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.samplingMode === SAMPLING_MODE.PREFLIGHT;
        },
      ],
    });
    const mockBestEffortRequest = MockApiClient.addMockResponse({
      url: '/test',
      body: ['has', 'data'],
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.samplingMode === SAMPLING_MODE.BEST_EFFORT;
        },
      ],
    });
    renderHook(
      () =>
        useProgressiveQuery({
          queryHookImplementation: useMockHookImpl,
          queryHookArgs: {enabled: true, query: 'test value'},

          // Use parallel mode to more easily test that the best effort request is not triggered
          queryOptions: {withholdBestEffort: true},
        }),
      {
        wrapper: createWrapper(
          OrganizationFixture({
            features: ['visibility-explore-progressive-loading'],
          })
        ),
      }
    );

    expect(mockRequestUrl).toHaveBeenCalledTimes(1);
    expect(mockBestEffortRequest).not.toHaveBeenCalled();
  });

  it('triggers the best effort request if the preflight request is empty and we want to withold the best effort request', async function () {
    mockRequestUrl = MockApiClient.addMockResponse({
      url: '/test',
      body: [],
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.samplingMode === SAMPLING_MODE.PREFLIGHT;
        },
      ],
    });
    const mockBestEffortRequest = MockApiClient.addMockResponse({
      url: '/test',
      body: ['has', 'data'],
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.samplingMode === SAMPLING_MODE.BEST_EFFORT;
        },
      ],
    });
    renderHook(
      () =>
        useProgressiveQuery({
          queryHookImplementation: useMockHookImpl,
          queryHookArgs: {enabled: true, query: 'test value'},
          queryOptions: {withholdBestEffort: true},
        }),
      {
        wrapper: createWrapper(
          OrganizationFixture({
            features: ['visibility-explore-progressive-loading'],
          })
        ),
      }
    );

    expect(mockRequestUrl).toHaveBeenCalledTimes(1);
    expect(mockRequestUrl).toHaveBeenCalledWith(
      '/test',
      expect.objectContaining({
        query: {samplingMode: SAMPLING_MODE.PREFLIGHT, query: 'test value'},
      })
    );

    await waitFor(() => {
      expect(mockBestEffortRequest).toHaveBeenCalledTimes(1);
    });
    expect(mockBestEffortRequest).toHaveBeenCalledWith(
      '/test',
      expect.objectContaining({
        query: {samplingMode: SAMPLING_MODE.BEST_EFFORT, query: 'test value'},
      })
    );
  });
});
