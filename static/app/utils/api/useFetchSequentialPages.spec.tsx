import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useFetchSequentialPages} from 'sentry/utils/api/useFetchSequentialPages';
import {getPaginationPageLink} from 'sentry/views/organizationStats/utils';

const MOCK_API_ENDPOINT = '/api-tokens/';

function getQueryOptionsFactory() {
  return jest.fn().mockImplementation(({cursor, per_page}) =>
    apiOptions.as<string>()(MOCK_API_ENDPOINT, {
      query: {cursor, per_page},
      staleTime: Infinity,
    })
  );
}

describe('useFetchSequentialPages', () => {
  it('should not call the queryFn when enabled is false', () => {
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchSequentialPages, {
      initialProps: {
        enabled: false,
        getQueryOptions,
        perPage: 10,
      },
    });

    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryOptions).not.toHaveBeenCalled();
  });

  it('should immediatly swith to isFetching=true when the enabled prop is changed', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
      headers: {Link: getPaginationPageLink({numRows: 0, pageSize: 100, offset: 0})},
    });
    const getQueryOptions = getQueryOptionsFactory();

    const {result, rerender} = renderHookWithProviders(useFetchSequentialPages, {
      initialProps: {
        enabled: false,
        getQueryOptions,
        perPage: 10,
      },
    });

    expect(result.current.status).toBe('pending');
    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryOptions).not.toHaveBeenCalled();

    rerender({enabled: true, getQueryOptions, perPage: 10});

    expect(result.current.status).toBe('pending');
    expect(result.current.isFetching).toBeTruthy();
    expect(getQueryOptions).toHaveBeenCalled();

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.isFetching).toBeFalsy();
  });

  it('should call the queryFn 1 times when the response has no pagination header', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
    });
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchSequentialPages, {
      initialProps: {
        enabled: true,
        getQueryOptions,
        perPage: 10,
      },
    });

    expect(result.current.status).toBe('pending');
    expect(result.current.isFetching).toBeTruthy();

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryOptions).toHaveBeenCalledTimes(1);
  });

  it('should call the queryFn 1 times when the first response has no next page', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: 'text result',
      headers: {Link: getPaginationPageLink({numRows: 0, pageSize: 10, offset: 0})},
    });
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchSequentialPages, {
      initialProps: {
        enabled: true,
        getQueryOptions,
        perPage: 10,
      },
    });

    expect(result.current.status).toBe('pending');
    expect(result.current.isFetching).toBeTruthy();

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryOptions).toHaveBeenCalledTimes(1);
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
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchSequentialPages, {
      initialProps: {
        enabled: true,
        getQueryOptions,
        perPage: 10,
      },
    });

    expect(result.current.status).toBe('pending');
    expect(result.current.isFetching).toBeTruthy();

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.isFetching).toBeFalsy();
    expect(getQueryOptions).toHaveBeenCalledTimes(2);
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
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchSequentialPages, {
      initialProps: {
        enabled: true,
        getQueryOptions,
        perPage: 10,
      },
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.isFetching).toBeFalsy();
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
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchSequentialPages, {
      initialProps: {
        enabled: true,
        getQueryOptions,
        perPage: 10,
      },
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.isFetching).toBeFalsy();
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
    const getQueryOptions = getQueryOptionsFactory();

    const {result} = renderHookWithProviders(useFetchSequentialPages, {
      initialProps: {
        enabled: true,
        getQueryOptions,
        perPage: 10,
      },
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.isFetching).toBeFalsy();
    expect(result.current.lastResponseHeaders?.Link).toBe(secondLinkHeader);
  });
});
