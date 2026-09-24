import fetchMock from 'jest-fetch-mock';

import {waitFor} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {
  Client,
  initApiClientErrorHandling,
  registerApiErrorHandler,
  Request,
  withCurrentPageAsNext,
} from 'sentry/api';
import {PROJECT_MOVED} from 'sentry/constants/apiErrorCodes';
import type {ResponseMeta} from 'sentry/types/api';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

jest.unmock('sentry/api');

describe('api', () => {
  let api: Client;

  beforeEach(() => {
    api = new MockApiClient();
    setWindowLocation('https://sentry.io/');
  });

  afterEach(() => {
    fetchMock.resetMocks();
  });

  describe('Client', () => {
    describe('cancel()', () => {
      it('should abort any open XHR requests', () => {
        const abort1 = jest.fn();
        const abort2 = jest.fn();

        const req1 = new Request(new Promise(() => null), {
          abort: abort1,
        } as any);
        const req2 = new Request(new Promise(() => null), {abort: abort2} as any);

        api.activeRequests = {
          1: req1,
          2: req2,
        };

        api.clear();

        expect(req1.aborter?.abort).toHaveBeenCalledTimes(1);
        expect(req2.aborter?.abort).toHaveBeenCalledTimes(1);
      });

      it('aborts an in-flight fetch request', async () => {
        fetchMock.mockResponse(() => '');
        const request = new Client().request('/test');

        request.cancel();

        await expect(request.requestPromise).rejects.toHaveProperty('name', 'AbortError');
      });
    });
  });

  it('does not call success callback if 302 was returned because of a project slug change', () => {
    const successCb = jest.fn();
    api.activeRequests = {
      id: {alive: true, requestPromise: new Promise(() => null), cancel: jest.fn()},
    };
    api.wrapCallback(
      'id',
      successCb
    )({
      responseJSON: {
        detail: {
          code: PROJECT_MOVED,
          message: '...',
          extra: {
            slug: 'new-slug',
          },
        },
      },
    });
    expect(successCb).not.toHaveBeenCalled();
  });

  it('handles error callback', () => {
    jest.spyOn(api, 'wrapCallback').mockImplementation((_id: string, func: any) => func);
    const errorCb = jest.fn();
    const args = ['test', true, 1] as unknown as [ResponseMeta, string, string];
    api.handleRequestError(
      {
        id: 'test',
        path: 'test',
        requestOptions: {error: errorCb},
      },
      ...args
    );

    expect(errorCb).toHaveBeenCalledWith(...args);
  });

  it('handles undefined error callback', () => {
    expect(() =>
      api.handleRequestError(
        {
          id: 'test',
          path: 'test',
          requestOptions: {},
        },
        {} as ResponseMeta,
        '',
        'test'
      )
    ).not.toThrow();
  });

  it('registers and unregisters global error handlers', async () => {
    const errorHandler = jest.fn(() => false);
    const unregister = registerApiErrorHandler(errorHandler);
    const client = new Client();

    fetchMock.mockResponseOnce(JSON.stringify({detail: 'Nope'}), {status: 500});
    await expect(client.requestPromise('/first/')).rejects.toBeDefined();
    expect(errorHandler).toHaveBeenCalledTimes(1);

    unregister();

    fetchMock.mockResponseOnce(JSON.stringify({detail: 'Still nope'}), {status: 500});
    await expect(client.requestPromise('/second/')).rejects.toBeDefined();
    expect(errorHandler).toHaveBeenCalledTimes(1);
  });

  describe('sso-required', () => {
    it('redirects to the SSO login with the current page as next', async () => {
      setWindowLocation(
        'https://acme.sentry.io/issues/123/?project=1&query=is%3Aunresolved#events'
      );
      const unregister = initApiClientErrorHandling();
      const client = new Client();

      fetchMock.mockResponseOnce(
        JSON.stringify({
          detail: {
            code: 'sso-required',
            message: 'Must login via SSO',
            extra: {
              loginUrl:
                'https://acme.sentry.io/auth/login/acme/?next=https%3A%2F%2Facme.sentry.io%2F',
              organizationSlug: 'acme',
            },
          },
        }),
        {status: 401}
      );
      // The handler swallows the response, so the request promise never settles
      client.request('/organizations/acme/');

      await waitFor(() => expect(testableWindowLocation.assign).toHaveBeenCalledTimes(1));
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        'https://acme.sentry.io/auth/login/acme/?next=' +
          encodeURIComponent(
            'https://acme.sentry.io/issues/123/?project=1&query=is%3Aunresolved#events'
          ).replace(/%20/g, '+')
      );
      unregister();
    });

    it('adds next when the login url has none', () => {
      setWindowLocation('https://sentry.io/organizations/acme/dashboards/');
      expect(withCurrentPageAsNext('/auth/login/acme/')).toBe(
        'https://sentry.io/auth/login/acme/?next=https%3A%2F%2Fsentry.io%2Forganizations%2Facme%2Fdashboards%2F'
      );
    });

    it('returns a missing or unparseable login url unchanged', () => {
      setWindowLocation('https://sentry.io/organizations/acme/issues/');
      expect(withCurrentPageAsNext('')).toBe('');
      expect(withCurrentPageAsNext('http://[bad')).toBe('http://[bad');
    });

    it('keeps the origin of a customer-domain login url', () => {
      setWindowLocation('https://sentry.io/organizations/acme/issues/');
      expect(withCurrentPageAsNext('https://acme.sentry.io/auth/login/acme/')).toBe(
        'https://acme.sentry.io/auth/login/acme/?next=https%3A%2F%2Fsentry.io%2Forganizations%2Facme%2Fissues%2F'
      );
    });
  });
});
