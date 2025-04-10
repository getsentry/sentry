import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {PageFilters} from 'sentry/types/core';
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
          queryMode: QUERY_MODE.SERIAL,
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
          queryMode: QUERY_MODE.PARALLEL,
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
          queryMode: QUERY_MODE.SERIAL,
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

  it.each([
    ['larger period', {period: '14d', start: null, end: null, utc: false}, 2],
    ['smaller period', {period: '4d', start: null, end: null, utc: false}, 1],
    [
      'absolute date with larger period (8d)',
      {period: null, start: '2024-01-01', end: '2024-01-09', utc: false},
      2,
    ],
    [
      'absolute date with smaller period (1d)',
      {period: null, start: '2024-01-01', end: '2024-01-02', utc: false},
      1,
    ],
  ])(
    'makes the correct number of requests for a %s',
    async function (
      _periodType: string,
      mockedDatetime: PageFilters['datetime'],
      expectedCalls: number
    ) {
      jest.mocked(usePageFilters).mockReturnValue({
        isReady: true,
        desyncedFilters: new Set(),
        pinnedFilters: new Set(),
        shouldPersist: true,
        selection: {
          datetime: mockedDatetime,
          environments: [],
          projects: [],
        },
      });

      renderHook(
        () =>
          useProgressiveQuery({
            queryHookImplementation: useMockHookImpl,
            queryHookArgs: {enabled: true, query: 'test value'},
            queryMode: QUERY_MODE.PARALLEL,
          }),
        {
          wrapper: createWrapper(
            OrganizationFixture({
              features: ['visibility-explore-progressive-loading'],
            })
          ),
        }
      );

      await waitFor(() => {
        expect(mockRequestUrl).toHaveBeenCalledTimes(expectedCalls);
      });
      if (expectedCalls === 1) {
        expect(mockRequestUrl).toHaveBeenCalledWith(
          '/test',
          expect.objectContaining({
            query: {samplingMode: SAMPLING_MODE.BEST_EFFORT, query: 'test value'},
          })
        );
      }
    }
  );

  it('skips the preflight request if the feature flag is enabled', function () {
    renderHook(
      () =>
        useProgressiveQuery({
          queryHookImplementation: useMockHookImpl,
          queryHookArgs: {enabled: true, query: 'test value'},
          queryMode: QUERY_MODE.SERIAL,
        }),
      {
        wrapper: createWrapper(
          OrganizationFixture({
            features: [
              'visibility-explore-skip-preflight',
              'visibility-explore-progressive-loading',
            ],
          })
        ),
      }
    );

    expect(mockRequestUrl).toHaveBeenCalledTimes(1);
    expect(mockRequestUrl).toHaveBeenCalledWith(
      '/test',
      expect.objectContaining({
        query: {samplingMode: SAMPLING_MODE.BEST_EFFORT, query: 'test value'},
      })
    );
  });
});
