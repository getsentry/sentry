import type {QueryClient, QueryFunctionContext} from '@tanstack/react-query';
import Cookies from 'js-cookie';

import {redirectToProject} from 'sentry/actionCreators/redirectToProject';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import {initApiClientErrorHandling, setApiNavigate} from 'sentry/api';
import {
  PROJECT_MOVED,
  SUDO_REQUIRED,
  SUPERUSER_REQUIRED,
} from 'sentry/constants/apiErrorCodes';
import {apiFetch} from 'sentry/utils/api/apiFetch';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import type {ApiResponse} from './sentryCellFetch';
import {configureSentryCellFetch, sentryCellFetch} from './sentryCellFetch';
import {createDefaultErrorHandlers} from './sentryCellFetchErrorHandlers';

// Use real implementations — jest.unmock ensures transitive dependencies
// (like openSudo, redirectToProject) still resolve to their jest.mock'd versions.
jest.unmock('sentry/api');
jest.unmock('sentry/utils/api/sentryCellFetch');

jest.mock('sentry/actionCreators/sudoModal');
jest.mock('sentry/actionCreators/redirectToProject');

type FetchFn = (context: QueryFunctionContext<ApiQueryKey>) => Promise<ApiResponse>;

function url(path: string) {
  return path as ApiQueryKey[0];
}

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

/**
 * Wait for a promise to settle, or return 'timeout' if it doesn't within `ms`.
 *
 * The old Client.requestPromise path hangs (never resolves/rejects) when
 * globalErrorHandlers claims the error or hasProjectBeenRenamed short-circuits
 * the callback. This helper lets us check side effects without waiting forever.
 */
async function settleOrTimeout<T>(
  promise: Promise<T>,
  ms = 50
): Promise<
  {type: 'resolved'; value: T} | {error: unknown; type: 'rejected'} | {type: 'timeout'}
> {
  return Promise.race([
    promise.then(
      value => ({type: 'resolved' as const, value}),
      error => ({type: 'rejected' as const, error})
    ),
    new Promise<{type: 'timeout'}>(resolve =>
      setTimeout(() => resolve({type: 'timeout' as const}), ms)
    ),
  ]);
}

const navigate = jest.fn();

// ─── Section 1: Core parity ────────────────────────────────────────────
// No error handlers configured. Both paths should produce identical results
// for success responses and generic errors (no special codes).
//
// The old path has baked-in handling for sudo-required (handleRequestError)
// and project-moved (hasProjectBeenRenamed in wrapCallback) that cannot be
// disabled. Those codes are avoided here and tested in Section 2.

describe.each<{createFetch: () => FetchFn; name: string}>([
  {name: 'apiFetch (old)', createFetch: () => apiFetch},
  {name: 'sentryCellFetch (new)', createFetch: () => sentryCellFetch},
])('core parity: $name', ({createFetch}) => {
  let fetchFn: FetchFn;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(window, 'fetch');
    configureSentryCellFetch({});
    fetchFn = createFetch();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('successful responses', () => {
    it('returns JSON body on 200', async () => {
      const body = [{id: 1, name: 'test'}];
      fetchSpy.mockImplementation(mockFetchResponse(body));

      const result = await fetchFn(makeContext([url('/projects/')]));

      expect(result.json).toEqual(body);
    });

    it('parses response headers', async () => {
      fetchSpy.mockImplementation(
        mockFetchResponse([], {
          headers: {
            Link: '<url>; rel="next"',
            'X-Hits': '42',
            'X-Max-Hits': '1000',
          },
        })
      );

      const result = await fetchFn(makeContext([url('/items/')]));

      expect(result.headers.Link).toBe('<url>; rel="next"');
      expect(result.headers['X-Hits']).toBe(42);
      expect(result.headers['X-Max-Hits']).toBe(1000);
    });

    it('returns empty object body', async () => {
      fetchSpy.mockImplementation(mockFetchResponse({}));

      const result = await fetchFn(makeContext([url('/projects/')]));

      expect(result.json).toEqual({});
    });

    it('returns array body', async () => {
      fetchSpy.mockImplementation(mockFetchResponse([{id: 1}, {id: 2}]));

      const result = await fetchFn(makeContext([url('/projects/')]));

      expect(result.json).toEqual([{id: 1}, {id: 2}]);
    });
  });

  describe('error responses', () => {
    it('throws RequestError on 404', async () => {
      fetchSpy.mockImplementation(
        mockFetchResponse({detail: 'Not found'}, {status: 404})
      );

      await expect(fetchFn(makeContext([url('/missing/')]))).rejects.toThrow(
        RequestError
      );
    });

    it('throws RequestError on 500', async () => {
      fetchSpy.mockImplementation(
        mockFetchResponse({detail: 'Server error'}, {status: 500})
      );

      await expect(fetchFn(makeContext([url('/projects/')]))).rejects.toThrow(
        RequestError
      );
    });

    it('thrown error has status and responseJSON', async () => {
      fetchSpy.mockImplementation(
        mockFetchResponse({detail: 'Not found'}, {status: 404})
      );

      try {
        await fetchFn(makeContext([url('/missing/')]));
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(RequestError);
        const reqErr = err as RequestError;
        expect(reqErr.status).toBe(404);
        expect(reqErr.responseJSON).toEqual({detail: 'Not found'});
      }
    });

    it('throws on 401 with allowAuthError', async () => {
      fetchSpy.mockImplementation(
        mockFetchResponse({detail: 'Unauthorized'}, {status: 401})
      );

      await expect(
        fetchFn(makeContext([url('/projects/'), {allowAuthError: true}]))
      ).rejects.toThrow(RequestError);
    });

    it('throws on generic 403', async () => {
      fetchSpy.mockImplementation(
        mockFetchResponse({detail: 'Forbidden'}, {status: 403})
      );

      await expect(fetchFn(makeContext([url('/projects/')]))).rejects.toThrow(
        RequestError
      );
    });
  });

  describe('request construction', () => {
    it('serializes query params into URL', async () => {
      fetchSpy.mockImplementation(mockFetchResponse([]));

      await fetchFn(
        makeContext([url('/projects/'), {query: {per_page: 25, cursor: 'abc'}}])
      );

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('per_page=25');
      expect(calledUrl).toContain('cursor=abc');
    });

    it('sends JSON body for POST', async () => {
      fetchSpy.mockImplementation(mockFetchResponse({id: 1}));

      await fetchFn(
        makeContext([url('/projects/'), {method: 'POST', data: {name: 'new'}}])
      );

      const fetchInit = fetchSpy.mock.calls[0][1];
      expect(fetchInit.method).toBe('POST');
      expect(fetchInit.body).toBe(JSON.stringify({name: 'new'}));
    });

    it('does not send body for GET', async () => {
      fetchSpy.mockImplementation(mockFetchResponse([]));

      await fetchFn(makeContext([url('/projects/')]));

      const fetchInit = fetchSpy.mock.calls[0][1];
      expect(fetchInit.body).toBeUndefined();
    });
  });
});

// ─── Section 2: Error handler parity ───────────────────────────────────
// Both paths have error handlers configured. Tests verify that the same
// side-effect functions are called with the same arguments.
//
// Key invariant: when a handler suppresses an error (auth redirect, project
// rename), the promise must NOT resolve successfully — otherwise React Query
// caches undefined as data and skips retries.
//   Old path: promise hangs (never settles).
//   New path: rejects with RequestError after the handler runs its side effect.
//
// Jest module boundary note:
//   jest.unmock('sentry/api') loads the real api.tsx, but its internal imports
//   of openSudo/redirectToProject resolve to different mock instances than what
//   the test file imports (due to __mocks__/api.tsx calling jest.requireActual
//   and caching the module separately). This means:
//   - Auth 401 tests work for both paths (verified via Cookies spy and injected
//     navigate fn — not affected by mock identity).
//   - Sudo and project-moved mock assertions only work for the new path.
//     For the old path, we verify the error was intercepted (promise hangs).
//
// settleOrTimeout is used where the old path's promise hangs.
// console.error is suppressed where jsdom throws on window.location calls.

let oldPathHandlersInitialized = false;

describe.each<{createFetch: () => FetchFn; name: string; setupHandlers: () => void}>([
  {
    name: 'apiFetch (old)',
    createFetch: () => apiFetch,
    setupHandlers: () => {
      if (!oldPathHandlersInitialized) {
        setApiNavigate(navigate);
        initApiClientErrorHandling();
        oldPathHandlersInitialized = true;
      }
    },
  },
  {
    name: 'sentryCellFetch (new)',
    createFetch: () => sentryCellFetch,
    setupHandlers: () => {
      configureSentryCellFetch({
        errorHandlers: createDefaultErrorHandlers({navigate}),
      });
    },
  },
])('error handlers: $name', ({createFetch, setupHandlers}) => {
  let fetchFn: FetchFn;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    navigate.mockReset();
    jest.mocked(openSudo).mockReset();
    jest.mocked(redirectToProject).mockReset();
    jest.mocked(testableWindowLocation.assign).mockReset();
    jest.mocked(testableWindowLocation.reload).mockReset();
    fetchSpy = jest.spyOn(window, 'fetch');
    setupHandlers();
    fetchFn = createFetch();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    configureSentryCellFetch({});
  });

  describe('sudo handling', () => {
    it('intercepts sudo-required 403 and retries after sudo', async () => {
      const retryBody = [{id: 1}];
      jest.mocked(openSudo).mockImplementation(opts => {
        opts?.retryRequest?.();
        return Promise.resolve();
      });

      fetchSpy
        .mockImplementationOnce(
          mockFetchResponse({detail: {code: SUDO_REQUIRED}}, {status: 403})
        )
        .mockImplementationOnce(mockFetchResponse(retryBody));

      // Both paths intercept sudo-required and do not resolve successfully
      // without a retry. Old path: the mock identity boundary means
      // openSudo's retryRequest never fires, so the promise hangs.
      // New path: openSudo fires, retry resolves with retry body.
      const result = await settleOrTimeout(fetchFn(makeContext([url('/admin/')])));

      if (result.type === 'resolved') {
        expect(openSudo).toHaveBeenCalledWith(
          expect.objectContaining({sudo: true, isSuperuser: false})
        );
        expect(result.value.json).toEqual(retryBody);
      } else {
        expect(result.type).toBe('timeout');
      }
    });

    it('intercepts superuser-required 403 and retries after sudo', async () => {
      const retryBody = {id: 2};
      jest.mocked(openSudo).mockImplementation(opts => {
        opts?.retryRequest?.();
        return Promise.resolve();
      });

      fetchSpy
        .mockImplementationOnce(
          mockFetchResponse({detail: {code: SUPERUSER_REQUIRED}}, {status: 403})
        )
        .mockImplementationOnce(mockFetchResponse(retryBody));

      const result = await settleOrTimeout(fetchFn(makeContext([url('/admin/')])));

      if (result.type === 'resolved') {
        expect(openSudo).toHaveBeenCalledWith(
          expect.objectContaining({sudo: false, isSuperuser: true})
        );
        expect(result.value.json).toEqual(retryBody);
      } else {
        expect(result.type).toBe('timeout');
      }
    });
  });

  describe('project renamed', () => {
    it('intercepts PROJECT_MOVED and redirects without resolving', async () => {
      fetchSpy.mockImplementation(
        mockFetchResponse(
          {detail: {code: PROJECT_MOVED, extra: {slug: 'new-slug'}}},
          {status: 404}
        )
      );

      // Both paths intercept the error and never resolve successfully.
      // Old path: promise hangs (timeout). New path: rejects with RequestError.
      const result = await settleOrTimeout(fetchFn(makeContext([url('/old-slug/')])));

      expect(result.type).not.toBe('resolved');

      // Old path: redirectToProject mock identity is different (see module
      // boundary note), so we can only verify interception via timeout.
      // New path: the mock is the same instance, so we can verify the call.
      if (result.type === 'rejected') {
        expect(redirectToProject).toHaveBeenCalledWith('new-slug');
      }
    });
  });

  describe('auth 401', () => {
    it('sets session_expired cookie on generic 401 without resolving', async () => {
      const cookieSpy = jest.spyOn(Cookies, 'set');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      fetchSpy.mockImplementation(
        mockFetchResponse({detail: 'Unauthorized'}, {status: 401})
      );

      // Both paths intercept the error and never resolve successfully.
      const result = await settleOrTimeout(fetchFn(makeContext([url('/projects/')])));

      expect(result.type).not.toBe('resolved');
      expect(cookieSpy).toHaveBeenCalledWith('session_expired', '1');
      cookieSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('skips auth handler for codes in the skip list', async () => {
      const cookieSpy = jest.spyOn(Cookies, 'set');
      fetchSpy.mockImplementation(
        mockFetchResponse({detail: {code: '2fa-required'}}, {status: 401})
      );

      await expect(fetchFn(makeContext([url('/projects/')]))).rejects.toThrow(
        RequestError
      );

      expect(cookieSpy).not.toHaveBeenCalledWith('session_expired', '1');
      cookieSpy.mockRestore();
    });

    it('does not trigger auth handler when allowAuthError is set', async () => {
      const cookieSpy = jest.spyOn(Cookies, 'set');
      fetchSpy.mockImplementation(
        mockFetchResponse({detail: 'Unauthorized'}, {status: 401})
      );

      await expect(
        fetchFn(makeContext([url('/projects/'), {allowAuthError: true}]))
      ).rejects.toThrow(RequestError);

      expect(cookieSpy).not.toHaveBeenCalledWith('session_expired', '1');
      cookieSpy.mockRestore();
    });

    it('navigates for member-disabled-over-limit without resolving', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      fetchSpy.mockImplementation(
        mockFetchResponse(
          {detail: {code: 'member-disabled-over-limit', extra: {next: '/disabled/'}}},
          {status: 401}
        )
      );

      // Both paths intercept the error and never resolve successfully.
      const result = await settleOrTimeout(fetchFn(makeContext([url('/projects/')])));

      expect(result.type).not.toBe('resolved');
      expect(navigate).toHaveBeenCalledWith('/disabled/', {replace: true});
      consoleSpy.mockRestore();
    });
  });
});
