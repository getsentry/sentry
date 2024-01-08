import {ReactNode} from 'react';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {ApiResult} from 'sentry/api';
import useAggregatedQueryKeys from 'sentry/utils/api/useAggregatedQueryKeys';
import {ApiQueryKey, QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';

function makeWrapper(queryClient: QueryClient) {
  return function wrapper({children}: {children?: ReactNode}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAggregatedQueryKeys', () => {
  let responseReducer;
  let initialProps;

  beforeEach(() => {
    responseReducer = jest.fn((prevState: any, response: ApiResult) => {
      return {
        ...prevState,
        ...response[0],
      };
    });

    initialProps = {
      getQueryKey: (ids: readonly string[]): ApiQueryKey => ['/api/test/', {query: ids}],
      onError: () => {},
      responseReducer,
      bufferLimit: 50,
    };
  });

  it('should convert multiple buffer calls into one fetch request after a timeout', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/api/test/`,
      body: {
        '1111': 5,
        '2222': 7,
        '3333': 11,
      },
    });

    const {result, waitFor} = reactHooks.renderHook(useAggregatedQueryKeys, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps,
    });

    result.current.buffer(['1111']);
    result.current.buffer(['2222', '3333']);

    await waitFor(() => {
      expect(responseReducer).toHaveBeenCalled();
    });

    expect(mockRequest).toHaveBeenCalledWith(
      `/api/test/`,
      expect.objectContaining({
        query: expect.arrayContaining(['1111', '2222', '3333']),
      })
    );
  });

  it('should send a fetch request immediatly if the buffer is full', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/api/test/`,
    });

    const {result, waitFor} = reactHooks.renderHook(useAggregatedQueryKeys, {
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
      url: `/api/test/`,
      body: {
        '1111': 5,
        '2222': 7,
        '3333': 11,
      },
    });

    // Initial instance, nothing is cached yet
    const {result: result1, waitFor} = reactHooks.renderHook(useAggregatedQueryKeys, {
      wrapper: makeWrapper(queryClient),
      initialProps,
    });

    // Nothing has been asked for yet:
    expect(result1.current.data).toEqual(undefined);

    result1.current.buffer(['1111']);
    result1.current.buffer(['2222', '3333']);

    // We asked for 3 things, but the cache is empty:
    expect(result1.current.data).toEqual(undefined);

    // Wait to full up the cache:
    await waitFor(() => {
      expect(responseReducer).toHaveBeenCalled();
    });

    // 2nd instance, re-uses the same cache
    const {result: result2} = reactHooks.renderHook(useAggregatedQueryKeys, {
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
    const mockResponse = {
      '1111': 5,
    };
    MockApiClient.addMockResponse({
      url: `/api/test/`,
      body: mockResponse,
    });

    const {result, waitFor} = reactHooks.renderHook(useAggregatedQueryKeys, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps,
    });

    result.current.buffer(['1111', '2222', '3333']);

    await waitFor(() => {
      expect(responseReducer).toHaveBeenCalled();
    });

    expect(responseReducer).toHaveBeenCalled();
    expect(responseReducer).toHaveBeenCalledWith(
      undefined,
      expect.arrayContaining([mockResponse]),
      ['1111', '2222', '3333']
    );
  });
});
