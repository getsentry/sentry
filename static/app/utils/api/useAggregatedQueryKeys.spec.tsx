import type {ReactNode} from 'react';
import {QueryClientProvider, type QueryClient} from '@tanstack/react-query';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useAggregatedQueryKeys} from 'sentry/utils/api/useAggregatedQueryKeys';

type ApiTokenCounts = Record<string, number>;

function makeWrapper(queryClient: QueryClient) {
  return function wrapper({children}: {children?: ReactNode}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function makeReducer() {
  return jest.fn(
    (
      prevState: ApiTokenCounts | undefined,
      response: ApiResponse<ApiTokenCounts>
    ): ApiTokenCounts => ({
      ...prevState,
      ...response.json,
    })
  );
}

const getQueryOptions = (ids: readonly string[]) =>
  apiOptions.as<ApiTokenCounts>()('/api-tokens/', {
    query: {ids},
    staleTime: 0,
  });

describe('useAggregatedQueryKeys', () => {
  let responseReducer: ReturnType<typeof makeReducer>;
  let initialProps: Parameters<typeof useAggregatedQueryKeys<string, ApiTokenCounts>>[0];

  beforeEach(() => {
    responseReducer = makeReducer();

    initialProps = {
      getQueryOptions,
      onError: () => {},
      responseReducer,
      bufferLimit: 50,
    };
  });

  it('should convert multiple buffer calls into one fetch request after a timeout', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: {
        '1111': 5,
        '2222': 7,
        '3333': 11,
      },
    });

    const {result} = renderHook(useAggregatedQueryKeys, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps,
    });

    result.current.buffer(['1111']);
    result.current.buffer(['2222', '3333']);

    await waitFor(() => {
      expect(responseReducer).toHaveBeenCalled();
    });

    expect(mockRequest).toHaveBeenCalledWith(
      '/api-tokens/',
      expect.objectContaining({
        query: expect.objectContaining({
          ids: expect.arrayContaining(['1111', '2222', '3333']),
        }),
      })
    );
  });

  it('should send a fetch request immediatly if the buffer is full', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/api-tokens/',
    });

    const {result} = renderHook(useAggregatedQueryKeys, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {...initialProps, bufferLimit: 2},
    });

    result.current.buffer(['1111']);
    expect(mockRequest).not.toHaveBeenCalled();

    result.current.buffer(['2222', '3333']);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => {
      expect(responseReducer).toHaveBeenCalled();
    });
  });

  it('should return cached data right away, if it exists in the cache', async () => {
    const queryClient = makeTestQueryClient();
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: {
        '1111': 5,
        '2222': 7,
        '3333': 11,
      },
    });

    // Initial instance, nothing is cached yet
    const {result: result1} = renderHook(useAggregatedQueryKeys, {
      wrapper: makeWrapper(queryClient),
      initialProps,
    });

    // Nothing has been asked for yet:
    expect(result1.current.data).toBeUndefined();

    result1.current.buffer(['1111']);
    result1.current.buffer(['2222', '3333']);

    // We asked for 3 things, but the cache is empty:
    expect(result1.current.data).toBeUndefined();

    // Wait to full up the cache:
    await waitFor(() => {
      expect(responseReducer).toHaveBeenCalled();
    });

    // 2nd instance, re-uses the same cache
    const {result: result2} = renderHook(useAggregatedQueryKeys, {
      wrapper: makeWrapper(queryClient),
      initialProps,
    });

    // The cache has data, no waiting!
    expect(result2.current.data).toEqual({
      '1111': 5,
      '2222': 7,
      '3333': 11,
    });
  });

  it('should pass in the list of all aggregates to the reducer function', async () => {
    const mockResponse: ApiTokenCounts = {
      '1111': 5,
    };
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: mockResponse,
    });

    const {result} = renderHook(useAggregatedQueryKeys, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps,
    });

    result.current.buffer(['1111', '2222', '3333']);

    await waitFor(() => {
      expect(responseReducer).toHaveBeenCalled();
    });

    expect(responseReducer).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({json: mockResponse}),
      ['1111', '2222', '3333']
    );
  });

  it('should separate callsites that have different cacheKeys', async () => {
    const wrapper = makeWrapper(makeTestQueryClient());
    const mockRequest = MockApiClient.addMockResponse({
      url: '/api-tokens/',
    });
    const responseReducer1 = makeReducer();
    const responseReducer2 = makeReducer();

    const {result: result1} = renderHook(useAggregatedQueryKeys, {
      wrapper,
      initialProps: {
        ...initialProps,
        cacheKey: 'cache key 1',
        responseReducer: responseReducer1,
      },
    });

    const {result: result2} = renderHook(useAggregatedQueryKeys, {
      wrapper,
      initialProps: {
        ...initialProps,
        cacheKey: 'cache key 2',
        responseReducer: responseReducer2,
      },
    });

    result1.current.buffer(['1111']);
    result2.current.buffer(['2222']);

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });
  });
});
