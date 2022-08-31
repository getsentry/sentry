import {Client, Request} from 'sentry/api';
import {PROJECT_MOVED} from 'sentry/constants/apiErrorCodes';

jest.unmock('sentry/api');

describe('api', function () {
  let api;

  beforeEach(function () {
    api = new Client();
  });

  describe('Client', function () {
    describe('cancel()', function () {
      it('should abort any open XHR requests', function () {
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
    });
  });

  it('does not call success callback if 302 was returned because of a project slug change', function () {
    const successCb = jest.fn();
    api.activeRequests = {id: {alive: true}};
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

  it('handles error callback', function () {
    jest.spyOn(api, 'wrapCallback').mockImplementation((_id, func) => func);
    const errorCb = jest.fn();
    const args = ['test', true, 1];
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

  it('handles undefined error callback', function () {
    expect(() =>
      api.handleRequestError(
        {
          id: 'test',
          path: 'test',
          requestOptions: {},
        },
        {},
        {}
      )
    ).not.toThrow();
  });
});
