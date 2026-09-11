import fetchMock from 'jest-fetch-mock';

import {setWindowLocation} from 'sentry-test/utils';

import {Client, registerApiErrorHandler, Request} from 'sentry/api';
import {PROJECT_MOVED} from 'sentry/constants/apiErrorCodes';
import type {ResponseMeta} from 'sentry/types/api';

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

  describe('addContractResponse', () => {
    const route = '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/';
    const path = {organizationIdOrSlug: 'org-slug', projectIdOrSlug: 'project-slug'};

    it('registers a GET response with encoded parameters, matchers, and headers', async () => {
      const body = [{id: '1', name: 'production', isHidden: false}];
      const mock = MockApiClient.addContractResponse(route, {
        path: {...path, projectIdOrSlug: 'project/slash'},
        method: undefined,
        body,
        headers: {Link: 'next-page'},
        match: [MockApiClient.matchQuery({visibility: 'visible'})],
      });
      const url = '/projects/org-slug/project%2Fslash/environments/';

      const [json, , response] = await api.requestPromise(url, {
        query: {visibility: 'visible'},
        includeAllArgs: true,
      });

      expect(json).toEqual(body);
      expect(response?.getResponseHeader('Link')).toBe('next-page');
      expect(mock).toHaveBeenCalledWith(
        url,
        expect.objectContaining({query: {visibility: 'visible'}})
      );
    });

    it('registers a response for an explicit PUT method', async () => {
      const body = [{id: '1', name: 'production', isHidden: true}];
      const mock = MockApiClient.addContractResponse(route, {path, method: 'PUT', body});

      await expect(
        api.requestPromise('/projects/org-slug/project-slug/environments/', {
          method: 'PUT',
        })
      ).resolves.toEqual(body);
      expect(mock).toHaveBeenCalledTimes(1);
    });

    it('supports routes without path parameters', async () => {
      MockApiClient.addContractResponse('/organizations/', {body: []});

      await expect(api.requestPromise('/organizations/')).resolves.toEqual([]);
    });

    it('requires the GET response shape when the method is omitted', () => {
      MockApiClient.addContractResponse(route, {
        path,
        // @ts-expect-error GET requires every environment to have an id.
        body: [{name: 'production', isHidden: false}],
      });
      // @ts-expect-error A successful response body is required.
      MockApiClient.addContractResponse(route, {path});
    });

    it('checks fixture values and rejects undeclared fields on inline responses', () => {
      const invalidFixture = {id: 1, name: 'production', isHidden: false};
      MockApiClient.addContractResponse(route, {
        path,
        // @ts-expect-error Environment IDs on the wire are strings.
        body: [invalidFixture],
      });
      MockApiClient.addContractResponse(route, {
        path,
        // @ts-expect-error displayName is not part of the backend response.
        body: [{id: '1', name: 'production', isHidden: false, displayName: 'Production'}],
      });
    });

    it('requires a contract for the route and method', () => {
      // @ts-expect-error This route does not have a response contract.
      MockApiClient.addContractResponse('/api-tokens/', {body: []});
      MockApiClient.addContractResponse(route, {
        path,
        // @ts-expect-error The route only has GET and PUT response contracts.
        method: 'POST',
        body: [],
      });
      MockApiClient.addContractResponse(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/',
        // @ts-expect-error GET returns a list, but POST returns a single filter.
        {path, method: 'POST', body: []}
      );
    });

    it('requires path parameters and rejects error status codes', () => {
      // @ts-expect-error Both organization and project path parameters are required.
      MockApiClient.addContractResponse(route, {body: []});
      MockApiClient.addContractResponse(route, {
        path,
        body: [],
        // @ts-expect-error Error responses must use addMockResponse.
        statusCode: 500,
      });
    });
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
});
