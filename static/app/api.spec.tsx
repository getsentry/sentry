import fetchMock from 'jest-fetch-mock';

import {setWindowLocation} from 'sentry-test/utils';

import {Client, Request} from 'sentry/api';
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
});
