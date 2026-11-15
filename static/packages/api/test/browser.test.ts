import {describe, expect, it} from 'vitest';
import {createSentryClient} from '@sentry/api';
import {createBrowserFetch, createBrowserSdkConfig, type FetchFn} from '../lib/browser-client.ts';

// Helper to capture headers/init from a fetch call
function captureFetch(): {mock: FetchFn; captured: {headers?: Headers; init?: RequestInit}} {
  const captured: {headers?: Headers; init?: RequestInit} = {};
  const mock: FetchFn = async (_input, init) => {
    captured.headers = new Headers(init?.headers);
    captured.init = init;
    return new Response('{}', {status: 200});
  };
  return {mock, captured};
}

async function withMockFetch<T>(mock: FetchFn, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = mock as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

describe('createBrowserFetch', () => {
  it('injects X-CSRFToken on POST', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'test-csrf-token'});
    await withMockFetch(mock, () => browserFetch('/api/0/projects/', {method: 'POST', body: '{}'}));
    expect(captured.headers?.get('X-CSRFToken')).toBe('test-csrf-token');
  });

  it('injects X-CSRFToken on PUT', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'test-csrf-token'});
    await withMockFetch(mock, () => browserFetch('/api/0/projects/my-proj/', {method: 'PUT', body: '{}'}));
    expect(captured.headers?.get('X-CSRFToken')).toBe('test-csrf-token');
  });

  it('injects X-CSRFToken on PATCH', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'test-csrf-token'});
    await withMockFetch(mock, () => browserFetch('/api/0/projects/my-proj/', {method: 'PATCH', body: '{}'}));
    expect(captured.headers?.get('X-CSRFToken')).toBe('test-csrf-token');
  });

  it('injects X-CSRFToken on DELETE', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'token'});
    await withMockFetch(mock, () => browserFetch('/api/0/projects/my-proj/', {method: 'DELETE'}));
    expect(captured.headers?.get('X-CSRFToken')).toBe('token');
  });

  it('does not inject X-CSRFToken on GET with explicit method', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'test-csrf-token'});
    await withMockFetch(mock, () => browserFetch('/api/0/projects/', {method: 'GET'}));
    expect(captured.headers?.get('X-CSRFToken')).toBeNull();
  });

  it('does not inject X-CSRFToken when called with no init (defaults to GET)', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'test-csrf-token'});
    await withMockFetch(mock, () => browserFetch('/api/0/projects/'));
    expect(captured.headers?.get('X-CSRFToken')).toBeNull();
  });

  it('does not inject X-CSRFToken on HEAD', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'token'});
    await withMockFetch(mock, () => browserFetch('/api/0/projects/', {method: 'HEAD'}));
    expect(captured.headers?.get('X-CSRFToken')).toBeNull();
  });

  it('injects X-CSRFToken when input is a Request object with POST method', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'token'});
    // Must use a full URL — relative paths are invalid in the Request constructor in Node.
    const request = new Request('https://sentry.io/api/0/projects/', {method: 'POST'});
    await withMockFetch(mock, () => browserFetch(request));
    expect(captured.headers?.get('X-CSRFToken')).toBe('token');
  });

  it('preserves Request object headers when no init.headers is provided', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'token'});
    const request = new Request('https://sentry.io/api/0/projects/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Custom': 'value'},
    });
    await withMockFetch(mock, () => browserFetch(request));
    expect(captured.headers?.get('Content-Type')).toBe('application/json');
    expect(captured.headers?.get('X-Custom')).toBe('value');
    expect(captured.headers?.get('X-CSRFToken')).toBe('token');
  });

  it('uses init.headers over Request object headers when both are provided', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'token'});
    const request = new Request('https://sentry.io/api/0/projects/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
    });
    await withMockFetch(mock, () =>
      browserFetch(request, {headers: {'Content-Type': 'text/plain'}}),
    );
    // init.headers wins — matches native fetch spec behavior
    expect(captured.headers?.get('Content-Type')).toBe('text/plain');
  });

  it('does not inject X-CSRFToken when input is a Request object with GET method', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'token'});
    const request = new Request('https://sentry.io/api/0/projects/');
    await withMockFetch(mock, () => browserFetch(request));
    expect(captured.headers?.get('X-CSRFToken')).toBeNull();
  });

  it('injects X-CSRFToken when input is a URL object with POST in init', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'token'});
    await withMockFetch(mock, () =>
      browserFetch(new URL('https://sentry.io/api/0/projects/'), {method: 'POST'}),
    );
    expect(captured.headers?.get('X-CSRFToken')).toBe('token');
  });

  it('preserves Request headers when init provides method but no headers', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'token'});
    const request = new Request('https://sentry.io/api/0/projects/my-proj/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
    });
    await withMockFetch(mock, () => browserFetch(request, {method: 'PUT'}));
    expect(captured.headers?.get('Content-Type')).toBe('application/json');
    expect(captured.headers?.get('X-CSRFToken')).toBe('token');
  });

  it('injects X-CSRFToken when init.method is lowercase', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'token'});
    await withMockFetch(mock, () => browserFetch('/api/0/projects/', {method: 'post'}));
    expect(captured.headers?.get('X-CSRFToken')).toBe('token');
  });

  it('does not inject empty CSRF token', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => ''});
    await withMockFetch(mock, () => browserFetch('/api/0/projects/', {method: 'POST'}));
    expect(captured.headers?.has('X-CSRFToken')).toBe(false);
  });

  it('sets credentials: include', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'token'});
    await withMockFetch(mock, () => browserFetch('/api/0/projects/', {method: 'POST'}));
    expect(captured.init?.credentials).toBe('include');
  });

  it('overrides caller-provided credentials with include', async () => {
    const {mock, captured} = captureFetch();
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'token'});
    await withMockFetch(mock, () => browserFetch('/api/0/projects/', {method: 'GET', credentials: 'omit'}));
    expect(captured.init?.credentials).toBe('include');
  });

  it('preserves the effective Request body, method, headers and cancellation', async () => {
    const controller = new AbortController();
    const reason = new Error('Request no longer needed');
    const request = new Request('https://example.test/api/0/projects/', {
      method: 'POST',
      body: JSON.stringify({name: 'example'}),
      headers: {'Content-Type': 'application/json', 'X-Context': 'request'},
      signal: controller.signal,
    });
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'csrf-token'});

    await withMockFetch(async (input, init) => {
      // Resolve Request + RequestInit as the underlying Fetch implementation does.
      const effective = new Request(input, init);
      expect(effective.method).toBe('POST');
      expect(await effective.json()).toEqual({name: 'example'});
      expect(effective.headers.get('Content-Type')).toBe('application/json');
      expect(effective.headers.get('X-Context')).toBe('request');
      expect(effective.headers.get('X-CSRFToken')).toBe('csrf-token');
      expect(effective.credentials).toBe('include');
      expect(effective.signal.aborted).toBe(false);
      controller.abort(reason);
      expect(effective.signal.aborted).toBe(true);
      expect(effective.signal.reason).toBe(reason);
      throw effective.signal.reason;
    }, async () => {
      await expect(browserFetch(request)).rejects.toBe(reason);
    });
  });

  it('preserves URL + init and an already-aborted custom reason', async () => {
    const reason = 'Caller cancelled';
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'csrf-token'});

    await withMockFetch(async (input, init) => {
      const effective = new Request(input, init);
      expect(effective.url).toBe('https://example.test/api/0/projects/');
      expect(effective.method).toBe('PUT');
      expect(await effective.text()).toBe('updated project');
      expect(effective.headers.get('Content-Type')).toBe('text/plain');
      expect(effective.headers.get('X-Context')).toBe('init');
      expect(effective.headers.get('X-CSRFToken')).toBe('csrf-token');
      expect(effective.signal.aborted).toBe(true);
      expect(effective.signal.reason).toBe(reason);
      throw effective.signal.reason;
    }, async () => {
      await expect(browserFetch(new URL('https://example.test/api/0/projects/'), {
        method: 'PUT',
        body: 'updated project',
        headers: {'Content-Type': 'text/plain', 'X-Context': 'init'},
        signal: AbortSignal.abort(reason),
      })).rejects.toBe(reason);
    });
  });

  it('uses explicit init overrides for the Request body, method, headers and signal', async () => {
    const original = new AbortController();
    const replacement = new AbortController();
    const reason = new Error('Replacement request cancelled');
    const request = new Request('https://example.test/api/0/projects/', {
      method: 'POST', body: 'original', headers: {'X-Original': 'true'}, signal: original.signal,
    });
    const browserFetch = createBrowserFetch({getCsrfToken: () => 'csrf-token'});

    await withMockFetch(async (input, init) => {
      const effective = new Request(input, init);
      expect(effective.method).toBe('PATCH');
      expect(await effective.text()).toBe('replacement');
      expect(effective.headers.has('X-Original')).toBe(false);
      expect(effective.headers.get('X-Replacement')).toBe('true');
      expect(effective.headers.get('X-CSRFToken')).toBe('csrf-token');
      original.abort(new Error('Original cancelled'));
      expect(effective.signal.aborted).toBe(false);
      replacement.abort(reason);
      expect(effective.signal.reason).toBe(reason);
      throw effective.signal.reason;
    }, async () => {
      await expect(browserFetch(request, {
        method: 'PATCH', body: 'replacement', headers: {'X-Replacement': 'true'},
        signal: replacement.signal,
      })).rejects.toBe(reason);
    });
  });

  it('forwards explicit signal: null alongside an already-aborted Request', async () => {
    const request = new Request('https://example.test/api/0/projects/', {
      signal: AbortSignal.abort(new Error('Original cancelled')),
    });
    const browserFetch = createBrowserFetch();

    await withMockFetch(async (input, init) => {
      expect(input).toBe(request);
      expect(init?.signal).toBeNull();
      return Response.json([]);
    }, async () => {
      const response = await browserFetch(request, {signal: null});
      expect(await response.json()).toEqual([]);
    });
  });
});

describe('createBrowserSdkConfig', () => {
  it('returns empty baseUrl by default', () => {
    const config = createBrowserSdkConfig();
    expect(config.baseUrl).toBe('');
  });

  it('accepts custom baseUrl', () => {
    const config = createBrowserSdkConfig({baseUrl: 'https://sentry.io'});
    expect(config.baseUrl).toBe('https://sentry.io');
  });

  it('returns a fetch function', () => {
    const config = createBrowserSdkConfig();
    expect(typeof config.fetch).toBe('function');
  });

  it('propagates in-flight cancellation through a configured SDK operation', async () => {
    const controller = new AbortController();
    const reason = new Error('Query cancelled');
    let started!: () => void;
    const requestStarted = new Promise<void>(resolve => { started = resolve; });
    const config = createBrowserSdkConfig({baseUrl: 'https://example.test'});
    const sentry = createSentryClient(config);

    await withMockFetch((input, init) => {
      const effective = new Request(input, init);
      expect(effective.method).toBe('GET');
      expect(effective.credentials).toBe('include');
      return new Promise<Response>((_resolve, reject) => {
        effective.signal.addEventListener('abort', () => reject(effective.signal.reason), {once: true});
        started();
      });
    }, async () => {
      const result = sentry.listOrganizations({signal: controller.signal, throwOnError: true});
      await Promise.race([requestStarted, result]);
      controller.abort(reason);
      await expect(result).rejects.toBe(reason);
    });
  });
});
