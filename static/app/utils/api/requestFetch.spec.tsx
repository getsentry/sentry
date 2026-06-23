import type {QueryClient, QueryFunctionContext} from '@tanstack/react-query';

import {
  PROJECT_MOVED,
  SUDO_REQUIRED,
  SUPERUSER_REQUIRED,
} from 'sentry/constants/apiErrorCodes';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {configureRequestFetch, requestFetch} from './requestFetch';

// Unmock so we test the real implementation
jest.unmock('sentry/utils/api/requestFetch');

function makeContext(
  queryKey: ApiQueryKey,
  options?: {signal?: AbortSignal}
): QueryFunctionContext<ApiQueryKey> {
  return {
    queryKey,
    signal: options?.signal ?? new AbortController().signal,
    meta: undefined,
    client: {} as QueryClient,
  };
}

function mockFetchResponse(
  body: unknown,
  init?: {headers?: Record<string, string>; status?: number; statusText?: string}
) {
  const status = init?.status ?? 200;
  const statusText = init?.statusText ?? 'OK';
  const responseHeaders = new Headers({
    'content-type': 'application/json',
    ...init?.headers,
  });

  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: responseHeaders,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  });
}

describe('requestFetch', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    configureRequestFetch({});
    fetchSpy = jest.spyOn(window, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns ApiResponse on successful JSON response', async () => {
    const body = [{id: 1, name: 'test'}];
    fetchSpy.mockImplementation(mockFetchResponse(body));

    const context = makeContext(['/projects/' as ApiQueryKey[0]]);
    const [url, options] = context.queryKey;
    const result = await requestFetch(url, options, context.signal);

    expect(result.json).toEqual(body);
    expect(result.headers).toBeDefined();
  });

  it('includes response headers in result', async () => {
    fetchSpy.mockImplementation(
      mockFetchResponse([], {
        headers: {
          Link: '<url>; rel="next"',
          'X-Hits': '42',
          'X-Max-Hits': '1000',
        },
      })
    );

    const context = makeContext(['/items/' as ApiQueryKey[0]]);
    const [url, options] = context.queryKey;
    const result = await requestFetch(url, options, context.signal);

    expect(result.headers.Link).toBe('<url>; rel="next"');
    expect(result.headers['X-Hits']).toBe(42);
    expect(result.headers['X-Max-Hits']).toBe(1000);
  });

  it('serializes query params into the URL', async () => {
    fetchSpy.mockImplementation(mockFetchResponse([]));

    const context = makeContext([
      '/projects/' as ApiQueryKey[0],
      {query: {per_page: 25, cursor: 'abc'}},
    ]);
    const [url, options] = context.queryKey;
    await requestFetch(url, options, context.signal);

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('per_page=25');
    expect(calledUrl).toContain('cursor=abc');
  });

  it('sends JSON body for POST requests', async () => {
    fetchSpy.mockImplementation(mockFetchResponse({id: 1}));

    const context = makeContext([
      '/projects/' as ApiQueryKey[0],
      {method: 'POST', data: {name: 'new'}},
    ]);
    const [url, options] = context.queryKey;
    await requestFetch(url, options, context.signal);

    const fetchInit = fetchSpy.mock.calls[0][1];
    expect(fetchInit.method).toBe('POST');
    expect(fetchInit.body).toBe(JSON.stringify({name: 'new'}));
  });

  it('passes context.signal to fetch', async () => {
    fetchSpy.mockImplementation(mockFetchResponse([]));
    const controller = new AbortController();

    const context = makeContext(['/projects/' as ApiQueryKey[0]], {
      signal: controller.signal,
    });
    const [url, options] = context.queryKey;
    await requestFetch(url, options, context.signal);

    expect(fetchSpy.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('throws RequestError on non-ok response with no handlers', async () => {
    fetchSpy.mockImplementation(
      mockFetchResponse({detail: 'Not found'}, {status: 404, statusText: 'Not Found'})
    );

    const context = makeContext(['/missing/' as ApiQueryKey[0]]);
    const [url, options] = context.queryKey;
    await expect(requestFetch(url, options, context.signal)).rejects.toThrow(
      RequestError
    );
  });

  describe('error handlers', () => {
    it('calls onAuthError for 401 responses and throws', async () => {
      const onAuthError = jest.fn().mockReturnValue(true);
      configureRequestFetch({errorHandlers: {onAuthError}});
      fetchSpy.mockImplementation(
        mockFetchResponse({detail: 'Unauthorized'}, {status: 401})
      );

      const context = makeContext(['/projects/' as ApiQueryKey[0]]);
      const [url, options] = context.queryKey;
      await expect(requestFetch(url, options, context.signal)).rejects.toThrow(
        RequestError
      );
      expect(onAuthError).toHaveBeenCalled();
    });

    it('throws when onAuthError returns false', async () => {
      const onAuthError = jest.fn().mockReturnValue(false);
      configureRequestFetch({errorHandlers: {onAuthError}});
      fetchSpy.mockImplementation(
        mockFetchResponse({detail: 'Unauthorized'}, {status: 401})
      );

      const context = makeContext(['/projects/' as ApiQueryKey[0]]);
      const [url, options] = context.queryKey;
      await expect(requestFetch(url, options, context.signal)).rejects.toThrow(
        RequestError
      );
    });

    it('calls onSudoRequired for sudo-required errors', async () => {
      const retryBody = [{id: 1}];
      const onSudoRequired = jest.fn().mockImplementation((_resp, retry) => retry());
      configureRequestFetch({errorHandlers: {onSudoRequired}});

      // First call returns sudo-required, second (retry) succeeds
      fetchSpy
        .mockImplementationOnce(
          mockFetchResponse(
            {detail: {code: SUDO_REQUIRED, message: 'Sudo required'}},
            {status: 403}
          )
        )
        .mockImplementationOnce(mockFetchResponse(retryBody));

      const context = makeContext(['/admin/' as ApiQueryKey[0]]);
      const [url, options] = context.queryKey;
      const result = await requestFetch(url, options, context.signal);

      expect(onSudoRequired).toHaveBeenCalledTimes(1);
      expect(result.json).toEqual(retryBody);
    });

    it('calls onSudoRequired for superuser-required errors', async () => {
      const onSudoRequired = jest.fn().mockImplementation((_resp, retry) => retry());
      configureRequestFetch({errorHandlers: {onSudoRequired}});

      fetchSpy
        .mockImplementationOnce(
          mockFetchResponse(
            {detail: {code: SUPERUSER_REQUIRED, message: 'Superuser required'}},
            {status: 403}
          )
        )
        .mockImplementationOnce(mockFetchResponse({ok: true}));

      const context = makeContext(['/admin/' as ApiQueryKey[0]]);
      const [url, options] = context.queryKey;
      await requestFetch(url, options, context.signal);

      expect(onSudoRequired).toHaveBeenCalledTimes(1);
    });

    it('calls onProjectRenamed for project-moved errors and throws', async () => {
      const onProjectRenamed = jest.fn().mockReturnValue(true);
      configureRequestFetch({errorHandlers: {onProjectRenamed}});
      fetchSpy.mockImplementation(
        mockFetchResponse(
          {detail: {code: PROJECT_MOVED, extra: {slug: 'new-slug'}}},
          {status: 404}
        )
      );

      const context = makeContext(['/projects/old-slug/' as ApiQueryKey[0]]);
      const [url, options] = context.queryKey;
      await expect(requestFetch(url, options, context.signal)).rejects.toThrow(
        RequestError
      );
      expect(onProjectRenamed).toHaveBeenCalled();
    });

    it('calls onError as catch-all for unhandled errors and throws', async () => {
      const onError = jest.fn().mockReturnValue(true);
      configureRequestFetch({errorHandlers: {onError}});
      fetchSpy.mockImplementation(
        mockFetchResponse({detail: 'Server error'}, {status: 500})
      );

      const context = makeContext(['/projects/' as ApiQueryKey[0]]);
      const [url, options] = context.queryKey;
      await expect(requestFetch(url, options, context.signal)).rejects.toThrow(
        RequestError
      );
      expect(onError).toHaveBeenCalled();
    });

    it('does not call onAuthError for non-401 errors', async () => {
      const onAuthError = jest.fn().mockReturnValue(true);
      const onError = jest.fn().mockReturnValue(true);
      configureRequestFetch({errorHandlers: {onAuthError, onError}});
      fetchSpy.mockImplementation(
        mockFetchResponse({detail: 'Forbidden'}, {status: 403})
      );

      const context = makeContext(['/projects/' as ApiQueryKey[0]]);
      const [url, options] = context.queryKey;
      await expect(requestFetch(url, options, context.signal)).rejects.toThrow(
        RequestError
      );
      expect(onAuthError).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });

    it('named handlers take priority over onError', async () => {
      const onAuthError = jest.fn().mockReturnValue(true);
      const onError = jest.fn().mockReturnValue(true);
      configureRequestFetch({errorHandlers: {onAuthError, onError}});
      fetchSpy.mockImplementation(
        mockFetchResponse({detail: 'Unauthorized'}, {status: 401})
      );

      const context = makeContext(['/projects/' as ApiQueryKey[0]]);
      const [url, options] = context.queryKey;
      await expect(requestFetch(url, options, context.signal)).rejects.toThrow(
        RequestError
      );
      expect(onAuthError).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });
});
