import $ from 'jquery';
import {Client, Request, paramsToQueryArgs} from 'app/api';
import GroupActions from 'app/actions/groupActions';

jest.unmock('app/api');

describe('api', function() {
  let sandbox;
  let api;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();

    api = new Client();
  });

  afterEach(function() {
    sandbox.restore();
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

    it('should convert params w/o itemIds or query to undefined', function() {
      expect(
        paramsToQueryArgs({
          foo: 'bar',
          bar: 'baz', // paramsToQueryArgs ignores these
        })
      ).toBeUndefined();
    });
  });

  describe('Client', function() {
    beforeEach(function() {
      sandbox.stub($, 'ajax');
    });

    describe('cancel()', function() {
      it('should abort any open XHR requests', function() {
        let req1 = new Request({
          abort: sinon.stub(),
        });
        let req2 = new Request({
          abort: sinon.stub(),
        });

        api.activeRequests = {
          1: req1,
          2: req2,
        };

        api.clear();

        expect(req1.xhr.abort.calledOnce).toBeTruthy();
        expect(req2.xhr.abort.calledOnce).toBeTruthy();
      });
    });
  });

  it('handles error callback', function() {
    sandbox.stub(api, 'wrapCallback', (id, func) => func);
    let errorCb = jest.fn();
    let args = ['test', true, 1];
    api.handleRequestError(
      {
        id: 'test',
        path: 'test',
        requestOptions: {error: errorCb},
      },
      ...args
    );

    expect(errorCb).toHaveBeenCalledWith(...args);
    api.wrapCallback.restore();
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
      sandbox.stub(api, '_wrapRequest');
      sandbox.stub(GroupActions, 'update'); // stub GroupActions.update call from api.update
    });

    it('should use itemIds as query if provided', function() {
      api.bulkUpdate({
        orgId: '1337',
        projectId: '1337',
        itemIds: [1, 2, 3],
        data: {status: 'unresolved'},
        query: 'is:resolved',
      });

      expect(api._wrapRequest.calledOnce).toBeTruthy();
      let requestArgs = api._wrapRequest.getCall(0).args[1];
      expect(requestArgs.query).toEqual({id: [1, 2, 3]});
    });

    it('should use query as query if itemIds are absent', function() {
      api.bulkUpdate({
        orgId: '1337',
        projectId: '1337',
        itemIds: null,
        data: {status: 'unresolved'},
        query: 'is:resolved',
      });

      expect(api._wrapRequest.calledOnce).toBeTruthy();
      let requestArgs = api._wrapRequest.getCall(0).args[1];
      expect(requestArgs.query).toEqual({query: 'is:resolved'});
    });
  });

  describe('merge()', function() {
    // TODO: this is totally copypasta from the test above. We need to refactor
    //       these API methods/tests.
    beforeEach(function() {
      sandbox.stub(api, '_wrapRequest');
      sandbox.stub(GroupActions, 'merge'); // stub GroupActions.merge call from api.merge
    });

    it('should use itemIds as query if provided', function() {
      api.merge({
        orgId: '1337',
        projectId: '1337',
        itemIds: [1, 2, 3],
        data: {status: 'unresolved'},
        query: 'is:resolved',
      });

      expect(api._wrapRequest.calledOnce).toBeTruthy();
      let requestArgs = api._wrapRequest.getCall(0).args[1];
      expect(requestArgs.query).toEqual({id: [1, 2, 3]});
    });

    it('should use query as query if itemIds are absent', function() {
      api.merge({
        orgId: '1337',
        projectId: '1337',
        itemIds: null,
        data: {status: 'unresolved'},
        query: 'is:resolved',
      });

      expect(api._wrapRequest.calledOnce).toBeTruthy();
      let requestArgs = api._wrapRequest.getCall(0).args[1];
      expect(requestArgs.query).toEqual({query: 'is:resolved'});
    });
  });
});
