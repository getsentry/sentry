import $ from 'jquery';
import * as Sentry from '@sentry/react';

import {Client, Request, paramsToQueryArgs} from 'app/api';
import GroupActions from 'app/actions/groupActions';
import {PROJECT_MOVED} from 'app/constants/apiErrorCodes';

jest.unmock('app/api');

describe('api', function() {
  let api;

  beforeEach(function() {
    api = new Client();
  });

  describe('paramsToQueryArgs()', function() {
    it('should convert itemIds properties to id array', function() {
      expect(
        paramsToQueryArgs({
          itemIds: [1, 2, 3],
          query: 'is:unresolved', // itemIds takes precedence
        })
      ).toEqual({id: [1, 2, 3]});
    });

    it('should extract query property if no itemIds', function() {
      expect(
        paramsToQueryArgs({
          query: 'is:unresolved',
          foo: 'bar',
        })
      ).toEqual({query: 'is:unresolved'});
    });

    it('should convert params w/o itemIds or query to empty object', function() {
      expect(
        paramsToQueryArgs({
          foo: 'bar',
          bar: 'baz', // paramsToQueryArgs ignores these
        })
      ).toEqual({});
    });

    it('should keep environment when query is provided', function() {
      expect(
        paramsToQueryArgs({
          query: 'is:unresolved',
          environment: 'production',
        })
      ).toEqual({query: 'is:unresolved', environment: 'production'});
    });

    it('should exclude environment when it is null/undefined', function() {
      expect(
        paramsToQueryArgs({
          query: 'is:unresolved',
          environment: null,
        })
      ).toEqual({query: 'is:unresolved'});
    });

    it('should handle non-empty projects', function() {
      expect(
        paramsToQueryArgs({
          itemIds: [1, 2, 3],
          project: [1],
        })
      ).toEqual({id: [1, 2, 3], project: [1]});

      expect(
        paramsToQueryArgs({
          itemIds: [1, 2, 3],
          project: [],
        })
      ).toEqual({id: [1, 2, 3]});

      expect(
        paramsToQueryArgs({
          itemIds: [1, 2, 3],
          project: null,
        })
      ).toEqual({id: [1, 2, 3]});
    });
  });

  describe('Client', function() {
    beforeEach(function() {
      jest.spyOn($, 'ajax');
    });

    describe('cancel()', function() {
      it('should abort any open XHR requests', function() {
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

  it('does not call success callback if 302 was returned because of a project slug change', function() {
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

  it('handles error callback', function() {
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

  it('handles undefined error callback', function() {
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

  describe('bulkUpdate()', function() {
    beforeEach(function() {
      jest.spyOn(api, '_wrapRequest');
      jest.spyOn(GroupActions, 'update'); // stub GroupActions.update call from api.update
    });

    it('should use itemIds as query if provided', function() {
      api.bulkUpdate({
        orgId: '1337',
        projectId: '1337',
        itemIds: [1, 2, 3],
        data: {status: 'unresolved'},
        query: 'is:resolved',
      });

      expect(api._wrapRequest).toHaveBeenCalledTimes(1);
      expect(api._wrapRequest).toHaveBeenCalledWith(
        '/projects/1337/1337/issues/',
        expect.objectContaining({query: {id: [1, 2, 3]}}),
        undefined
      );
    });

    it('should use query as query if itemIds are absent', function() {
      api.bulkUpdate({
        orgId: '1337',
        projectId: '1337',
        itemIds: null,
        data: {status: 'unresolved'},
        query: 'is:resolved',
      });

      expect(api._wrapRequest).toHaveBeenCalledTimes(1);
      expect(api._wrapRequest).toHaveBeenCalledWith(
        '/projects/1337/1337/issues/',
        expect.objectContaining({query: {query: 'is:resolved'}}),
        undefined
      );
    });

    it('should apply project option', function() {
      api.bulkUpdate({
        orgId: '1337',
        project: [99],
        itemIds: [1, 2, 3],
        data: {status: 'unresolved'},
      });

      expect(api._wrapRequest).toHaveBeenCalledTimes(1);
      expect(api._wrapRequest).toHaveBeenCalledWith(
        '/organizations/1337/issues/',
        expect.objectContaining({query: {id: [1, 2, 3], project: [99]}}),
        undefined
      );
    });
  });

  describe('merge()', function() {
    // TODO: this is totally copypasta from the test above. We need to refactor
    //       these API methods/tests.
    beforeEach(function() {
      jest.spyOn(api, '_wrapRequest');
      jest.spyOn(GroupActions, 'merge'); // stub GroupActions.merge call from api.merge
    });

    it('should use itemIds as query if provided', function() {
      api.merge({
        orgId: '1337',
        projectId: '1337',
        itemIds: [1, 2, 3],
        data: {status: 'unresolved'},
        query: 'is:resolved',
      });

      expect(api._wrapRequest).toHaveBeenCalledTimes(1);
      expect(api._wrapRequest).toHaveBeenCalledWith(
        '/projects/1337/1337/issues/',
        expect.objectContaining({query: {id: [1, 2, 3]}}),
        undefined
      );
    });

    it('should use query as query if itemIds are absent', function() {
      api.merge({
        orgId: '1337',
        projectId: '1337',
        itemIds: null,
        data: {status: 'unresolved'},
        query: 'is:resolved',
      });

      expect(api._wrapRequest).toHaveBeenCalledTimes(1);
      expect(api._wrapRequest).toHaveBeenCalledWith(
        '/projects/1337/1337/issues/',
        expect.objectContaining({query: {query: 'is:resolved'}}),
        undefined
      );
    });
  });

  describe('Sentry reporting', function() {
    beforeEach(function() {
      jest.spyOn($, 'ajax');

      $.ajax.mockReset();
      Sentry.captureException.mockClear();

      $.ajax.mockImplementation(async ({error}) => {
        await tick();
        error({
          status: 500,
          statusText: 'Internal server error',
          responseJSON: {detail: 'Item was not found'},
        });

        return {};
      });
    });
  });
});
