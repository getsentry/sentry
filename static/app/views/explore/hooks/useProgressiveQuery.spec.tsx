import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {
  QUERY_MODE,
  SAMPLING_MODE,
  type SamplingMode,
  useProgressiveQuery,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {OrganizationContext} from 'sentry/views/organizationContext';

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
        <OrganizationContext.Provider value={org}>
          {children}
        </OrganizationContext.Provider>
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
});
