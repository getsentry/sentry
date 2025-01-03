import type {ReactNode} from 'react';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import useFetchSequentialPages from 'sentry/utils/api/useFetchSequentialPages';
import type {QueryClient} from 'sentry/utils/queryClient';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {getPaginationPageLink} from 'sentry/views/organizationStats/utils';

function makeWrapper(queryClient: QueryClient) {
  return function wrapper({children}: {children?: ReactNode}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const MOCK_API_ENDPOINT = '/api/test/';
function queryKeyFactory() {
  return jest.fn().mockImplementation(query => [MOCK_API_ENDPOINT, {query}]);
}

describe('useFetchSequentialPages', () => {
  it('should not call the queryFn when enabled is false', () => {
    const getQueryKey = queryKeyFactory();

    const {result} = renderHook(useFetchSequentialPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: false,
        getQueryKey,
        perPage: 10,
      },
    });

    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryKey).not.toHaveBeenCalled();
  });

  it('should immediatly swith to isFetching=true when the enabled prop is changed', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
      headers: {Link: getPaginationPageLink({numRows: 0, pageSize: 100, offset: 0})},
    });
    const getQueryKey = queryKeyFactory();

    const {result, rerender} = renderHook(useFetchSequentialPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: false,
        getQueryKey,
        perPage: 10,
      },
    });

    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryKey).not.toHaveBeenCalled();

    rerender({enabled: true, getQueryKey, perPage: 10});

    expect(result.current.isFetching).toBeTruthy();
    expect(getQueryKey).toHaveBeenCalled();

    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
  });

  it('should call the queryFn 1 times when the response has no pagination header', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
    });
    const getQueryKey = queryKeyFactory();

    const {result} = renderHook(useFetchSequentialPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: true,
        getQueryKey,
        perPage: 10,
      },
    });

    expect(result.current.isFetching).toBeTruthy();
    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
    expect(getQueryKey).toHaveBeenCalledTimes(1);
  });

  it('should call the queryFn 1 times when the first response has no next page', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
      headers: {Link: getPaginationPageLink({numRows: 0, pageSize: 10, offset: 0})},
    });
    const getQueryKey = queryKeyFactory();

    const {result} = renderHook(useFetchSequentialPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: true,
        getQueryKey,
        perPage: 10,
      },
    });

    expect(result.current.isFetching).toBeTruthy();
    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
    expect(getQueryKey).toHaveBeenCalledTimes(1);
  });

  it('should call the queryFn N times, until the response has no next page', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'results starting at 0',
      match: [MockApiClient.matchQuery({cursor: '0:0:0', per_page: 10})],
      headers: {Link: getPaginationPageLink({numRows: 13, pageSize: 10, offset: 0})},
    });
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'results starting at 10',
      match: [MockApiClient.matchQuery({cursor: '0:10:0', per_page: 10})],
      headers: {Link: getPaginationPageLink({numRows: 13, pageSize: 10, offset: 10})},
    });
    const getQueryKey = queryKeyFactory();

    const {result} = renderHook(useFetchSequentialPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: true,
        getQueryKey,
        perPage: 10,
      },
    });

    expect(result.current.isFetching).toBeTruthy();
    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
    expect(getQueryKey).toHaveBeenCalledTimes(2);
  });

  it('should return a list of all pages that have been resolved', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'results starting at 0',
      match: [MockApiClient.matchQuery({cursor: '0:0:0', per_page: 10})],
      headers: {Link: getPaginationPageLink({numRows: 13, pageSize: 10, offset: 0})},
    });
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'results starting at 10',
      match: [MockApiClient.matchQuery({cursor: '0:10:0', per_page: 10})],
      headers: {Link: getPaginationPageLink({numRows: 13, pageSize: 10, offset: 10})},
    });
    const getQueryKey = queryKeyFactory();

    const {result} = renderHook(useFetchSequentialPages, {
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
    expect(result.current.error).toBeUndefined();
  });

  it('should stop fetching if there is an error', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      statusCode: 429,
      match: [MockApiClient.matchQuery({cursor: '0:0:0', per_page: 10})],
    });
    const getQueryKey = queryKeyFactory();

    const {result} = renderHook(useFetchSequentialPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: true,
        getQueryKey,
        hits: 13,
        perPage: 10,
      },
    });

    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
    expect(result.current.isError).toBeTruthy();
    expect(result.current.error).toEqual(expect.objectContaining({status: 429}));
  });

  it('should return the final ResponseHeader that was resolved', async () => {
    const secondLinkHeader = getPaginationPageLink({
      numRows: 13,
      pageSize: 10,
      offset: 10,
    });
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'results starting at 0',
      headers: {Link: getPaginationPageLink({numRows: 13, pageSize: 10, offset: 0})},
      match: [MockApiClient.matchQuery({cursor: '0:0:0', per_page: 10})],
    });
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'results starting at 10',
      headers: {Link: secondLinkHeader},
      match: [MockApiClient.matchQuery({cursor: '0:10:0', per_page: 10})],
    });
    const getQueryKey = queryKeyFactory();

    const {result} = renderHook(useFetchSequentialPages, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {
        enabled: true,
        getQueryKey,
        perPage: 10,
      },
    });

    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
    expect(result.current.getLastResponseHeader).toStrictEqual(expect.any(Function));
    expect(result.current.getLastResponseHeader?.('Link')).toBe(secondLinkHeader);
  });
});
