import type {Scope} from '@sentry/core';
import * as Sentry from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import * as projectRedirect from 'sentry/actionCreators/redirectToProject';
import {Client, resolveHostname} from 'sentry/api';

import * as sudoModal from './actionCreators/sudoModal';
import {PROJECT_MOVED, SUPERUSER_REQUIRED} from './constants/apiErrorCodes';
import ConfigStore from './stores/configStore';
import OrganizationStore from './stores/organizationStore';

jest.unmock('sentry/api');
jest.unmock('sentry/apiClient');

// Mimicks native AbortError class
class AbortError extends Error {
  name = 'AbortError';
}

class NetworkError extends Error {
  name = 'NetworkError';
}

function makeScopeMock(): Partial<Scope> {
  return {
    setTags: jest.fn(),
    setExtras: jest.fn(),
    setFingerprint: jest.fn(),
  };
}

describe('Client', () => {
  describe('request', function () {
    describe('query params', function () {
      it('appends query params to path', function () {
        const spy = jest.spyOn(global, 'fetch');
        const client = new Client();

        client.request('/api/0/broadcasts/', {
          query: {foo: 'bar'},
        });

        expect(spy).toHaveBeenCalledWith(
          expect.stringContaining('/api/0/broadcasts/?foo=bar'),
          expect.objectContaining({
            method: 'GET',
          })
        );
      });

      it('appends query params to existing query params', function () {
        const spy = jest.spyOn(global, 'fetch');
        const client = new Client();

        client.request('/api/0/broadcasts/?foo=baz', {
          query: {foo: 'bar'},
        });

        expect(spy).toHaveBeenCalledWith(
          expect.stringContaining('/api/0/broadcasts/?foo=baz&foo=bar'),
          expect.objectContaining({
            method: 'GET',
          })
        );
      });

      it('appends data as query params to existing query params', function () {
        const spy = jest.spyOn(global, 'fetch');
        const client = new Client();

        client.request('/api/0/broadcasts/?foo=foo', {
          method: 'GET',
          data: {foo: 'bar'},
          query: {foo: 'baz'},
        });

        expect(spy).toHaveBeenCalledWith(
          expect.stringContaining('/api/0/broadcasts/?foo=foo&foo=baz&foo=bar'),
          expect.objectContaining({
            method: 'GET',
            body: undefined,
          })
        );
      });

      it('serialized options.data as query params for GET request', function () {
        const spy = jest.spyOn(global, 'fetch');
        const client = new Client();

        client.request('/api/0/broadcasts/?foo=baz', {
          method: 'GET',
          data: {foo: 'bar'},
        });

        expect(spy).toHaveBeenCalledWith(
          expect.stringContaining('/api/0/broadcasts/?foo=baz&foo=bar'),
          expect.objectContaining({
            method: 'GET',
            body: undefined,
          })
        );
      });
    });

    describe('request cancellation', function () {
      const originalAbortController = window.AbortController;
      beforeEach(() => {
        Object.defineProperty(window, 'AbortController', {
          value: originalAbortController,
        });
      });

      it('feature detects AbortController', function () {
        const client = new Client();
        Object.defineProperty(window, 'AbortController', {
          value: undefined,
        });
        expect(() => client.request('/api/0/broadcasts/')).not.toThrow();
      });

      it('cancels request', function () {
        const client = new Client();
        const request = client.request('/api/0/broadcasts/');
        const abortSpy = jest.spyOn(request.aborter!, 'abort');

        request.cancel();

        expect(request.alive).toBe(false);
        expect(abortSpy).toHaveBeenCalled();
      });

      it('prevents cancellation', function () {
        const client = new Client();
        const request = client.request('/api/0/broadcasts/', {cancelable: false});

        request.cancel();

        // The old version of the client was always marking the request as not alive, but
        // it was never actually cancelling the request. This was corrected in the new client.
        expect(request.alive).toBe(true);
        expect(request.aborter).toBeUndefined();
      });
    });

    describe('request tracking', function () {
      it('tracks requests', function () {
        const client = new Client();
        const request = client.request('/api/0/broadcasts/');

        expect(client.activeRequests[request.id]).toBe(request);
      });

      it('stops tracking request after it resolves', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response());

        const client = new Client();
        const onSuccess = jest.fn();
        client.request('/api/0/broadcasts/', {success: onSuccess});
        // We cannot await client.request because it does not return the entire promise chain and does not include the
        // chain which performs async reading of response.json() or response.text(), so we will wait until the request is
        // no longer in the activeRequests map.
        await waitFor(() => Object.keys(client.activeRequests).length === 0);
        expect(onSuccess).toHaveBeenCalled();
      });

      it('stops tracking request after it errors', async () => {
        jest
          .spyOn(global, 'fetch')
          .mockResolvedValueOnce(new Response(null, {status: 500}));

        const client = new Client();
        const onError = jest.fn();
        client.request('/api/0/broadcasts/', {error: onError});
        await waitFor(() => Object.keys(client.activeRequests).length === 0);
        expect(onError).toHaveBeenCalled();
      });
    });

    describe('headers', function () {
      it('respects constructor headers', function () {
        const client = new Client({headers: {foo: 'bar'}});

        let headers: Headers | undefined;

        jest.spyOn(global, 'fetch').mockImplementationOnce((...args: any[]) => {
          headers = args[1]?.headers;
          return Promise.resolve(new Response());
        });

        client.request('/api/0/broadcasts/');
        expect(headers?.get?.('foo')).toBe('bar');
      });

      it('merges constructor headers with request headers', function () {
        const client = new Client({headers: {foo: 'bar'}});

        let headers: Headers | undefined;

        jest.spyOn(global, 'fetch').mockImplementationOnce((...args: any[]) => {
          headers = args[1]?.headers;
          return Promise.resolve(new Response());
        });

        client.request('/api/0/broadcasts/', {headers: {baz: 'foo'}});
        expect(headers?.get?.('foo')).toBe('bar');
        expect(headers?.get?.('baz')).toBe('foo');
      });
    });

    describe('credentials', function () {
      it('respects constructor credential options', function () {
        const client = new Client({credentials: 'include'});
        client.request('/api/0/broadcasts/');

        const spy = jest.spyOn(global, 'fetch');
        expect(spy).toHaveBeenCalledWith(
          expect.stringContaining('/api/0/broadcasts/'),
          expect.objectContaining({credentials: 'include'})
        );
      });
    });

    describe('clear', function () {
      it('clears cancelable requests', function () {
        const client = new Client();
        const request = client.request('/api/0/broadcasts/');
        const cancelSpy = jest.spyOn(request, 'cancel');

        client.clear();
        expect(cancelSpy).toHaveBeenCalled();

        // I believe this is a memory leak in the old client, where the request was never
        // actually cancelled or marked as not alive, leaving it forever stored in our client request map.
        expect(Object.keys(client.activeRequests)).toHaveLength(0);
      });

      it('does not cancel non-cancelable requests', function () {
        const client = new Client();
        const request = client.request('/api/0/broadcasts/', {cancelable: false});

        const cancelSpy = jest.spyOn(request, 'cancel');
        client.clear();

        // The method is called, but it does not cancel the request.
        expect(cancelSpy).toHaveBeenCalled();
        expect(Object.keys(client.activeRequests)).toHaveLength(1);
      });
    });

    describe('error handling', function () {
      it('handles 200 OK response with response.text() failure', async function () {
        const client = new Client();
        const scopeMock = makeScopeMock();

        jest.spyOn(Sentry, 'withScope').mockImplementation((callback: any) => {
          callback(scopeMock);
        });

        const failingResponseText = new Response(null, {status: 200});
        failingResponseText.text = jest
          .fn()
          .mockRejectedValueOnce(
            new Error('You are not allowed to read response.text()')
          );

        jest.spyOn(global, 'fetch').mockResolvedValueOnce(failingResponseText);

        const onError = jest.fn();
        client.request('/api/0/broadcasts/', {error: onError});

        await waitFor(() => expect(onError).toHaveBeenCalled());

        // This is a bug with the old client, where it does not set responseText on the parsed response,
        // which is a value we use down the line to determine if the response was a 200 OK that we failed to parse.
        expect(scopeMock.setExtras).toHaveBeenCalledWith(
          expect.objectContaining({
            twoHundredErrorReason: 'Failed attempting to read response.text()',
            errorReason: 'Error: You are not allowed to read response.text()',
          })
        );
      });

      // This is a bug with the old client, where we rely on status to be 200 and presence of response.text() before logging the error
      // However, if the request fails before we can read response.text(), we will not have a 200 status and response.text()
      // will not be present, hence no error will be logged. The new client handles this case correctly, skip previous client logs
      it('handles AbortError', async function () {
        const client = new Client();
        const scopeMock = makeScopeMock();

        const response = new Response(null, {status: 200});

        let reject: ((reason?: any) => void) | null = null;

        const textPromiseMock = jest.fn().mockImplementation(() => {
          return new Promise((_resolve, _reject) => {
            reject = _reject;
          });
        });

        response.text = textPromiseMock;

        jest.spyOn(global, 'fetch').mockResolvedValueOnce(response);
        jest.spyOn(Sentry, 'withScope').mockImplementation((callback: any) => {
          callback(scopeMock);
          return callback;
        });

        const onError = jest.fn();
        const request = client.request('/api/0/broadcasts/', {error: onError});
        request.cancel();

        await waitFor(() => expect(textPromiseMock).toHaveBeenCalled());

        if (typeof reject === 'function') {
          // @ts-expect-error ts thinks this is never assigned
          reject(new AbortError());
        }

        await waitFor(() => expect(onError).toHaveBeenCalled());

        expect(scopeMock.setExtras).toHaveBeenCalledWith(
          expect.objectContaining({
            errorReason: 'Request was aborted',
          })
        );
      });

      // This is a bug with the old client, where we rely on status to be 200 and presence of response.text() before logging the error
      // However, if the request fails before we can read response.text(), we will not have a 200 status and response.text()
      // will not be present, hence no error will be logged. The new client handles this case correctly, skip previous client logs.
      it('handles generic error', async function () {
        const client = new Client();
        const scopeMock = makeScopeMock();

        const response = new Response(null, {status: 200});
        let reject: ((reason?: any) => void) | null = null;

        const textPromiseMock = jest.fn().mockImplementation(() => {
          return new Promise((_resolve, _reject) => {
            reject = _reject;
          });
        });

        response.text = textPromiseMock;

        jest.spyOn(global, 'fetch').mockResolvedValueOnce(response);
        jest.spyOn(Sentry, 'withScope').mockImplementation((callback: any) => {
          callback(scopeMock);
          return callback;
        });

        const onError = jest.fn();
        const request = client.request('/api/0/broadcasts/', {error: onError});
        request.cancel();

        await waitFor(() => expect(textPromiseMock).toHaveBeenCalled());

        if (typeof reject === 'function') {
          // @ts-expect-error ts thinks this is never assigned
          reject(new NetworkError());
        }

        await waitFor(() => expect(onError).toHaveBeenCalled());

        expect(scopeMock.setExtras).toHaveBeenCalledWith(
          expect.objectContaining({
            errorReason: 'NetworkError',
          })
        );
      });

      it('invalid JSON parsing error', async function () {
        const client = new Client();
        const scopeMock = makeScopeMock();

        const response = new Response(null, {
          status: 200,
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
        });

        response.text = jest
          .fn()
          .mockResolvedValueOnce(JSON.stringify({response: [{x: 1, y: 2}]}).slice(0, 10));
        response.json = jest.fn().mockRejectedValueOnce(new SyntaxError('Invalid JSON'));

        jest.spyOn(global, 'fetch').mockResolvedValueOnce(response);
        jest.spyOn(Sentry, 'withScope').mockImplementation((callback: any) => {
          callback(scopeMock);
          return callback;
        });

        const onError = jest.fn();
        client.request('/api/0/broadcasts/', {error: onError});

        await waitFor(() => expect(onError).toHaveBeenCalled());

        expect(scopeMock.setExtras).toHaveBeenCalledWith(
          expect.objectContaining({
            twoHundredErrorReason: 'Failed attempting to parse JSON from responseText',
            errorReason: 'JSON parse error',
          })
        );
      });

      it('invalid JSON parse error', async function () {
        const client = new Client();
        const scopeMock = makeScopeMock();

        const response = new Response(null, {
          status: 200,
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
        });

        response.text = jest
          .fn()
          .mockResolvedValueOnce(JSON.stringify({response: [{x: 1, y: 2}]}).slice(0, 10));
        response.json = jest.fn().mockRejectedValueOnce(new SyntaxError('Invalid JSON'));

        jest.spyOn(global, 'fetch').mockResolvedValueOnce(response);
        jest.spyOn(Sentry, 'withScope').mockImplementation((callback: any) => {
          callback(scopeMock);
          return callback;
        });

        const onError = jest.fn();
        client.request('/api/0/broadcasts/', {error: onError});

        await waitFor(() => expect(onError).toHaveBeenCalled());

        expect(scopeMock.setExtras).toHaveBeenCalledWith(
          expect.objectContaining({
            twoHundredErrorReason: 'Failed attempting to parse JSON from responseText',
            errorReason: 'JSON parse error',
          })
        );
      });

      it('POST 200 with empty response body that expects JSON is not marked as error', async function () {
        const client = new Client();
        const scopeMock = makeScopeMock();

        const response = new Response(null, {
          status: 200,
          headers: new Headers({
            // Mismatching content type
            'Content-Type': 'text/html',
          }),
        });

        response.text = jest.fn().mockResolvedValueOnce(' ');
        response.json = jest.fn().mockRejectedValueOnce(new SyntaxError('Invalid JSON'));

        jest.spyOn(global, 'fetch').mockResolvedValueOnce(response);
        jest.spyOn(Sentry, 'withScope').mockImplementation((callback: any) => {
          callback(scopeMock);
          return callback;
        });

        const onError = jest.fn();
        client.request('/api/0/broadcasts/', {method: 'POST', error: onError});

        await waitFor(() => expect(onError).toHaveBeenCalled());

        expect(scopeMock.setExtras).toHaveBeenCalledWith(
          expect.objectContaining({
            twoHundredErrorReason: 'Failed attempting to parse JSON from responseText',
            errorReason: 'JSON parse error. Possibly returned HTML',
          })
        );
      });
    });
  });

  it('project redirect modal', async function () {
    const client = new Client();

    const response = new Response(null, {
      status: 302,
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    });

    const responseText = {
      detail: {
        code: PROJECT_MOVED,
        extra: {
          slug: 'new-project-slug',
        },
      },
    };

    response.text = jest.fn().mockResolvedValueOnce(JSON.stringify(responseText));
    response.json = jest.fn().mockResolvedValueOnce(responseText);

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(response);
    jest.spyOn(projectRedirect, 'redirectToProject');

    const onError = jest.fn();
    const onSuccess = jest.fn();
    const onComplete = jest.fn();
    client.request('/api/0/broadcasts/', {
      method: 'POST',
      error: onError,
      success: onSuccess,
      complete: onComplete,
    });

    await waitFor(() =>
      expect(projectRedirect.redirectToProject).toHaveBeenCalledWith('new-project-slug')
    );

    // None of the callbacks get called and the promise is suspended indefinitely
    // while the timer counts down and redirects to the new project slug
    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  describe('sudo modal', () => {
    it('opens sudo modal', async function () {
      const client = new Client();

      const response = new Response(null, {
        status: 401,
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      });

      const responseText = {
        detail: {
          code: SUPERUSER_REQUIRED,
        },
      };

      response.text = jest.fn().mockResolvedValueOnce(JSON.stringify(responseText));
      response.json = jest.fn().mockResolvedValueOnce(responseText);

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(response);
      jest.spyOn(sudoModal, 'openSudo');

      const onError = jest.fn();
      client.request('/api/0/broadcasts/', {method: 'POST', error: onError});

      await waitFor(() =>
        expect(sudoModal.openSudo).toHaveBeenCalledWith(
          expect.objectContaining({
            isSuperuser: true,
          })
        )
      );
    });

    it('calls original request callback handlers', async function () {
      const client = new Client();

      const response = new Response(null, {
        status: 401,
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      });

      const responseText = {
        detail: {
          code: SUPERUSER_REQUIRED,
        },
      };

      let retryRequest: (() => Promise<any>) | undefined = undefined;

      jest.spyOn(sudoModal, 'openSudo').mockImplementation(props => {
        retryRequest = props?.retryRequest;
        return Promise.resolve();
      });

      response.text = jest.fn().mockResolvedValueOnce(JSON.stringify(responseText));
      response.json = jest.fn().mockResolvedValueOnce(responseText);

      const fetchSpy = jest.spyOn(global, 'fetch');

      fetchSpy.mockResolvedValueOnce(response);
      jest.spyOn(sudoModal, 'openSudo');

      const onError = jest.fn();
      const onSuccess = jest.fn();

      client.request('/api/0/broadcasts/', {
        method: 'POST',
        error: onError,
        success: onSuccess,
      });

      await waitFor(() => expect(sudoModal.openSudo).toHaveBeenCalled());

      const successResponse = new Response(null, {
        status: 200,
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      });

      const successResponseJSON = {
        detail: {
          code: 'success',
        },
      };

      successResponse.text = jest
        .fn()
        .mockResolvedValueOnce(JSON.stringify(successResponseJSON));
      successResponse.json = jest.fn().mockResolvedValueOnce(successResponseJSON);

      fetchSpy.mockResolvedValueOnce(successResponse);

      await retryRequest!();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    });
  });
});

describe('resolveHostname', function () {
  let devUi: boolean | undefined;
  let location: Location;
  let configstate: ReturnType<typeof ConfigStore.getState>;

  const controlPath = '/api/0/broadcasts/';
  const regionPath = '/api/0/organizations/slug/issues/';

  beforeEach(function () {
    configstate = ConfigStore.getState();
    location = window.location;
    devUi = window.__SENTRY_DEV_UI;

    ConfigStore.loadInitialData({
      ...configstate,
      features: new Set(['system:multi-region']),
      links: {
        organizationUrl: 'https://acme.sentry.io',
        sentryUrl: 'https://sentry.io',
        regionUrl: 'https://us.sentry.io',
      },
    });
  });

  afterEach(() => {
    window.location = location;
    window.__SENTRY_DEV_UI = devUi;
    ConfigStore.loadInitialData(configstate);
  });

  it('does nothing without feature', function () {
    ConfigStore.loadInitialData({
      ...configstate,
      // Remove the feature flag
      features: new Set(),
    });

    let result = resolveHostname(controlPath);
    expect(result).toBe(controlPath);

    // Explicit domains still work.
    result = resolveHostname(controlPath, 'https://sentry.io');
    expect(result).toBe(`https://sentry.io${controlPath}`);

    result = resolveHostname(regionPath, 'https://de.sentry.io');
    expect(result).toBe(`https://de.sentry.io${regionPath}`);
  });

  it('does not override region in _admin', function () {
    Object.defineProperty(window, 'location', {
      configurable: true,
      enumerable: true,
      value: new URL('https://sentry.io/_admin/'),
    });

    // Adds domain to control paths
    let result = resolveHostname(controlPath);
    expect(result).toBe('https://sentry.io/api/0/broadcasts/');

    // Doesn't add domain to region paths
    result = resolveHostname(regionPath);
    expect(result).toBe(regionPath);

    // Explicit domains still work.
    result = resolveHostname(controlPath, 'https://sentry.io');
    expect(result).toBe(`https://sentry.io${controlPath}`);

    result = resolveHostname(regionPath, 'https://de.sentry.io');
    expect(result).toBe(`https://de.sentry.io${regionPath}`);
  });

  it('adds domains when feature enabled', function () {
    let result = resolveHostname(regionPath);
    expect(result).toBe('https://us.sentry.io/api/0/organizations/slug/issues/');

    result = resolveHostname(controlPath);
    expect(result).toBe('https://sentry.io/api/0/broadcasts/');
  });

  it('matches if querystrings are in path', function () {
    const result = resolveHostname(
      '/api/0/organizations/acme/sentry-app-components/?projectId=123'
    );
    expect(result).toBe(
      'https://sentry.io/api/0/organizations/acme/sentry-app-components/?projectId=123'
    );
  });

  it('uses paths for region silo in dev-ui', function () {
    window.__SENTRY_DEV_UI = true;

    let result = resolveHostname(regionPath);
    expect(result).toBe('/region/us/api/0/organizations/slug/issues/');

    result = resolveHostname(controlPath);
    expect(result).toBe('/api/0/broadcasts/');
  });

  it('removes sentryUrl from dev-ui mode requests', function () {
    window.__SENTRY_DEV_UI = true;

    let result = resolveHostname(regionPath, 'https://sentry.io');
    expect(result).toBe('/api/0/organizations/slug/issues/');

    result = resolveHostname(controlPath, 'https://sentry.io');
    expect(result).toBe('/api/0/broadcasts/');
  });

  it('removes sentryUrl from dev-ui mode requests when feature is off', function () {
    window.__SENTRY_DEV_UI = true;
    // Org does not have the required feature.
    OrganizationStore.onUpdate(OrganizationFixture());

    let result = resolveHostname(controlPath);
    expect(result).toBe(controlPath);

    // control silo shaped URLs don't get a host
    result = resolveHostname(controlPath, 'https://sentry.io');
    expect(result).toBe(controlPath);

    result = resolveHostname(regionPath, 'https://de.sentry.io');
    expect(result).toBe(`/region/de${regionPath}`);
  });

  it('preserves host parameters', function () {
    const result = resolveHostname(regionPath, 'https://de.sentry.io');
    expect(result).toBe('https://de.sentry.io/api/0/organizations/slug/issues/');
  });
});

describe('isSimilarOrigin', function () {
  test.each([
    // Same domain
    ['https://sentry.io', 'https://sentry.io', true],
    ['https://example.io', 'https://example.io', true],

    // Not the same
    ['https://example.io', 'https://sentry.io', false],
    ['https://sentry.io', 'https://io.sentry', false],

    // Sibling domains
    ['https://us.sentry.io', 'https://sentry.sentry.io', true],
    ['https://us.sentry.io', 'https://acme.sentry.io', true],
    ['https://us.sentry.io', 'https://eu.sentry.io', true],
    ['https://woof.sentry.io', 'https://woof-org.sentry.io', true],
    ['https://woof.sentry.io/issues/1234/', 'https://woof-org.sentry.io', true],

    // Subdomain
    ['https://sentry.io/api/0/broadcasts/', 'https://woof.sentry.io', true],
    ['https://sentry.io/api/0/users/', 'https://sentry.sentry.io', true],
    ['https://sentry.io/api/0/users/', 'https://io.sentry.io', true],
    // request to subdomain from parent
    ['https://us.sentry.io/api/0/users/', 'https://sentry.io', true],

    // Not siblings
    ['https://sentry.io/api/0/broadcasts/', 'https://sentry.example.io', false],
    ['https://acme.sentry.io', 'https://acme.sent.ryio', false],
    ['https://woof.example.io', 'https://woof.sentry.io', false],
    ['https://woof.sentry.io', 'https://sentry.woof.io', false],
  ])('allows sibling domains %s and %s is %s', (target, origin, expected) => {
    expect(Client.isSimilarOrigin(target, origin)).toBe(expected);
  });
});
