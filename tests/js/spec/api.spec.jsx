import $ from 'jquery';

import {Client, Request} from 'app/api';
import {PROJECT_MOVED} from 'app/constants/apiErrorCodes';

jest.unmock('app/api');

describe('api', function () {
  let api;

  beforeEach(function () {
    api = new Client();
  });

  describe('Client', function () {
    beforeEach(function () {
      jest.spyOn($, 'ajax');
    });

    describe('cancel()', function () {
      it('should abort any open XHR requests', function () {
        const req1 = new Request({
          abort: jest.fn(),
        });
        const req2 = new Request({
          abort: jest.fn(),
        });

        api.activeRequests = {
          1: req1,
          2: req2,
        };

        api.clear();

        expect(req1.xhr.abort).toHaveBeenCalledTimes(1);
        expect(req2.xhr.abort).toHaveBeenCalledTimes(1);
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
