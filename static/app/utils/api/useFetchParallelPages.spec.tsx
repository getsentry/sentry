import type {ReactNode} from 'react';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useFetchParallelPages from 'sentry/utils/api/useFetchParallelPages';
import type {QueryClient} from 'sentry/utils/queryClient';
import {QueryClientProvider} from 'sentry/utils/queryClient';

function makeWrapper(queryClient: QueryClient) {
  return function wrapper({children}: {children?: ReactNode}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const MOCK_API_ENDPOINT = '/api/test/';
function queryKeyFactory() {
  return jest.fn().mockImplementation(query => [MOCK_API_ENDPOINT, {query}]);
}

describe('useFetchParallelPages', () => {
  it('should not call the queryFn when enabled is false', () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
    });
    const getQueryKey = queryKeyFactory();

    const {result} = reactHooks.renderHook(useFetchParallelPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: false,
        getQueryKey,
        hits: 13,
        perPage: 10,
      },
    });

    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryKey).not.toHaveBeenCalled();
  });

  it('should immediately switch to isFetching=true when the prop is changed', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
    });
    const getQueryKey = queryKeyFactory();

    const {result, rerender, waitFor} = reactHooks.renderHook(useFetchParallelPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: false,
        getQueryKey,
        hits: 13,
        perPage: 10,
      },
    });

    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryKey).not.toHaveBeenCalled();

    rerender({enabled: true, getQueryKey, hits: 13, perPage: 10});

    expect(result.current.isFetching).toBeTruthy();
    expect(getQueryKey).toHaveBeenCalled();

    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
  });

  it('should call the queryFn zero times, when hits is 0', () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
    });
    const getQueryKey = queryKeyFactory();

    const {result} = reactHooks.renderHook(useFetchParallelPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: true,
        getQueryKey,
        hits: 0,
        perPage: 10,
      },
    });

    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryKey).not.toHaveBeenCalled();
  });

  it('should call the queryFn 1 times, when hits is less than the perPage size', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
    });
    const getQueryKey = queryKeyFactory();

    const {result, waitFor} = reactHooks.renderHook(useFetchParallelPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: true,
        getQueryKey,
        hits: 7,
        perPage: 10,
      },
    });

    expect(result.current.isFetching).toBeTruthy();
    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
    expect(getQueryKey).toHaveBeenCalledTimes(1);
  });

  it('should call the queryFn N times, depending on how many hits we expect', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
    });
    const getQueryKey = queryKeyFactory();

    const {result, waitFor} = reactHooks.renderHook(useFetchParallelPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: true,
        getQueryKey,
        hits: 21,
        perPage: 10,
      },
    });

    expect(result.current.isFetching).toBeTruthy();
    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
    expect(getQueryKey).toHaveBeenCalledTimes(3);
  });

  it('should return a list of all pages that have been resolved', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'results starting at 0',
      match: [MockApiClient.matchQuery({cursor: '0:0:0', per_page: 10})],
    });
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'results starting at 10',
      match: [MockApiClient.matchQuery({cursor: '0:10:0', per_page: 10})],
    });
    const getQueryKey = queryKeyFactory();

    const {result, waitFor} = reactHooks.renderHook(useFetchParallelPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: true,
        getQueryKey,
        hits: 13,
        perPage: 10,
      },
    });

    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
    expect(result.current.pages).toEqual([
      'results starting at 0',
      'results starting at 10',
    ]);
    expect(result.current.error).toEqual([]);
  });

  it('should reduce isError and isFetching', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
    });
    const getQueryKey = queryKeyFactory();

    const {result, waitFor} = reactHooks.renderHook(useFetchParallelPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: true,
        getQueryKey,
        hits: 13,
        perPage: 10,
      },
    });

    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
    expect(result.current.isError).toBeFalsy();
  });

  it('should return the final ResponseHeader that has been resolved', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'results starting at 0',
      headers: {Link: 'next: 0:10:0'},
      match: [MockApiClient.matchQuery({cursor: '0:0:0', per_page: 10})],
    });
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'results starting at 10',
      headers: {Link: 'next: 0:20:0'},
      match: [MockApiClient.matchQuery({cursor: '0:10:0', per_page: 10})],
    });
    const getQueryKey = queryKeyFactory();

    const {result, waitFor} = reactHooks.renderHook(useFetchParallelPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: true,
        getQueryKey,
        hits: 13,
        perPage: 10,
      },
    });

    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
    expect(result.current.getLastResponseHeader).toStrictEqual(expect.any(Function));
    expect(result.current.getLastResponseHeader?.('Link')).toBe('next: 0:20:0');
  });

  it('should have isFetching=true as long as something is outstanding', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'results starting at 0',
      match: [MockApiClient.matchQuery({cursor: '0:0:0', per_page: 10})],
      asyncDelay: 200,
    });
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'results starting at 10',
      match: [MockApiClient.matchQuery({cursor: '0:10:0', per_page: 10})],
      asyncDelay: 500,
    });

    const getQueryKey = queryKeyFactory();

    const {result, waitFor} = reactHooks.renderHook(useFetchParallelPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: true,
        getQueryKey,
        hits: 13,
        perPage: 10,
      },
    });

    // No responses have resolved
    expect(result.current.isFetching).toBeTruthy();

    // Both responses have resolved
    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
    expect(result.current.pages).toEqual([
      'results starting at 0',
      'results starting at 10',
    ]);
  });
});
