import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useFetchParallelPages} from 'sentry/utils/api/useFetchParallelPages';

const MOCK_API_ENDPOINT = '/api-tokens/';

function getQueryOptionsFactory() {
  return jest.fn().mockImplementation(({cursor, per_page}) =>
    apiOptions.as<string>()(MOCK_API_ENDPOINT, {
      query: {cursor, per_page},
      staleTime: Infinity,
    })
  );
}

describe('useFetchParallelPages', () => {
  it('should not call the queryFn when enabled is false', () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
    });
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchParallelPages, {
      initialProps: {
        enabled: false,
        getQueryOptions,
        hits: 13,
        perPage: 10,
      },
    });

    expect(result.current.status).toBe('pending');
    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryOptions).not.toHaveBeenCalled();
  });

  it('should immediately switch to isFetching=true when the prop is changed', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
    });
    const getQueryOptions = getQueryOptionsFactory();

    const {result, rerender} = renderHookWithProviders(useFetchParallelPages, {
      initialProps: {
        enabled: false,
        getQueryOptions,
        hits: 13,
        perPage: 10,
      },
    });

    expect(result.current.status).toBe('pending');
    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryOptions).not.toHaveBeenCalled();

    rerender({enabled: true, getQueryOptions, hits: 13, perPage: 10});

    expect(result.current.status).toBe('pending');
    expect(result.current.isFetching).toBeTruthy();
    expect(getQueryOptions).toHaveBeenCalled();

    // Wait for the query to resolve
    await waitFor(() => expect(result.current.status).toBe('pending'));
    expect(result.current.isFetching).toBeTruthy();
  });

  it('should call the queryFn zero times, when hits is 0', () => {
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchParallelPages, {
      initialProps: {
        enabled: true,
        getQueryOptions,
        hits: 0,
        perPage: 10,
      },
    });

    expect(result.current.status).toBe('success');
    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryOptions).not.toHaveBeenCalled();
  });

  it('should call the queryFn zero times, and flip to state=success when hits is 0', () => {
    const getQueryOptions = getQueryOptionsFactory();

    const {result, rerender} = renderHookWithProviders(useFetchParallelPages, {
      initialProps: {
        enabled: false,
        getQueryOptions,
        hits: 0,
        perPage: 10,
      },
    });

    expect(result.current.status).toBe('pending');
    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryOptions).not.toHaveBeenCalled();

    rerender({enabled: true, getQueryOptions, hits: 0, perPage: 10});

    expect(result.current.status).toBe('success');
    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryOptions).not.toHaveBeenCalled();
  });

  it('should call the queryFn 1 times, when hits is less than the perPage size', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
    });
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchParallelPages, {
      initialProps: {
        enabled: true,
        getQueryOptions,
        hits: 7,
        perPage: 10,
      },
    });

    expect(result.current.status).toBe('pending');
    expect(result.current.isFetching).toBeTruthy();

    // Wait for the query to resolve
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryOptions).toHaveBeenCalledTimes(1);
  });

  it('should call the queryFn N times, depending on how many hits we expect', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
    });
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchParallelPages, {
      initialProps: {
        enabled: true,
        getQueryOptions,
        hits: 21,
        perPage: 10,
      },
    });

    expect(result.current.status).toBe('pending');
    expect(result.current.isFetching).toBeTruthy();

    // Wait for the query to resolve
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryOptions).toHaveBeenCalledTimes(3);
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
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchParallelPages, {
      initialProps: {
        enabled: true,
        getQueryOptions,
        hits: 13,
        perPage: 10,
      },
    });

    // Wait for the query to resolve
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.isFetching).toBeFalsy();
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
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchParallelPages, {
      initialProps: {
        enabled: true,
        getQueryOptions,
        hits: 13,
        perPage: 10,
      },
    });

    // Wait for the query to resolve
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.isFetching).toBeFalsy();
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
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchParallelPages, {
      initialProps: {
        enabled: true,
        getQueryOptions,
        hits: 13,
        perPage: 10,
      },
    });

    // Wait for the query to resolve
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.isFetching).toBeFalsy();
    expect(result.current.lastResponseHeaders?.Link).toBe('next: 0:20:0');
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

    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchParallelPages, {
      initialProps: {
        enabled: true,
        getQueryOptions,
        hits: 13,
        perPage: 10,
      },
    });

    // No responses have resolved
    expect(result.current.status).toBe('pending');
    expect(result.current.isFetching).toBeTruthy();

    // Both responses have resolved
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.isFetching).toBeFalsy();
    expect(result.current.pages).toEqual([
      'results starting at 0',
      'results starting at 10',
    ]);
  });
});
