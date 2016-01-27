import $ from 'jquery';
import {Client, Request, paramsToQueryArgs} from 'app/api';
import GroupActions from 'app/actions/groupActions';

describe('api', function () {
  beforeEach(function () {
    this.sandbox = sinon.sandbox.create();

    this.api = new Client();
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe('paramsToQueryArgs()', function () {
    it('should convert itemIds properties to id array', function () {
      expect(paramsToQueryArgs({
        itemIds: [1, 2, 3],
        query: 'is:unresolved' // itemIds takes precedence
      })).to.eql({id: [1, 2, 3]});
    });

    it('should extract query property if no itemIds', function () {
      expect(paramsToQueryArgs({
        query: 'is:unresolved',
        foo: 'bar'
      })).to.eql({query: 'is:unresolved'});
    });

    it('should convert params w/o itemIds or query to undefined', function () {
      expect(paramsToQueryArgs({
        foo: 'bar',
        bar: 'baz' // paramsToQueryArgs ignores these
      })).to.be.undefined;
    });
  });

  describe('Client', function () {
    beforeEach(function () {
      this.sandbox.stub($, 'ajax');
    });

    describe('cancel()', function () {
      it('should abort any open XHR requests', function () {
        let req1 = new Request({
          abort: sinon.stub()
        });
        let req2 = new Request({
          abort: sinon.stub()
        });

        this.api.activeRequests = {
          1: req1,
          2: req2
        };

        this.api.clear();

        expect(req1.xhr.abort.calledOnce).to.be.ok;
        expect(req2.xhr.abort.calledOnce).to.be.ok;
      });
    });
  });

  describe('bulkUpdate()', function () {
    beforeEach(function () {
      this.sandbox.stub(this.api, '_wrapRequest');
      this.sandbox.stub(GroupActions, 'update'); // stub GroupActions.update call from api.update
    });

    it('should use itemIds as query if provided', function () {
      this.api.bulkUpdate({
        orgId: '1337',
        projectId: '1337',
        itemIds: [1,2,3],
        data: {status: 'unresolved'},
        query: 'is:resolved'
      });

      expect(this.api._wrapRequest.calledOnce).to.be.ok;
      let requestArgs = this.api._wrapRequest.getCall(0).args[1];
      expect(requestArgs.query).to.eql({id: [1, 2, 3]});
    });

    it('should use query as query if itemIds are absent', function () {
      this.api.bulkUpdate({
        orgId: '1337',
        projectId: '1337',
        itemIds: null,
        data: {status: 'unresolved'},
        query: 'is:resolved'
      });

      expect(this.api._wrapRequest.calledOnce).to.be.ok;
      let requestArgs = this.api._wrapRequest.getCall(0).args[1];
      expect(requestArgs.query).to.eql({query: 'is:resolved'});
    });
  });

  describe('merge()', function () {
    // TODO: this is totally copypasta from the test above. We need to refactor
    //       these API methods/tests.
    beforeEach(function () {
      this.sandbox.stub(this.api, '_wrapRequest');
      this.sandbox.stub(GroupActions, 'merge'); // stub GroupActions.merge call from api.merge
    });

    it('should use itemIds as query if provided', function () {
      this.api.merge({
        orgId: '1337',
        projectId: '1337',
        itemIds: [1,2,3],
        data: {status: 'unresolved'},
        query: 'is:resolved'
      });

      expect(this.api._wrapRequest.calledOnce).to.be.ok;
      let requestArgs = this.api._wrapRequest.getCall(0).args[1];
      expect(requestArgs.query).to.eql({id: [1, 2, 3]});
    });

    it('should use query as query if itemIds are absent', function () {
      this.api.merge({
        orgId: '1337',
        projectId: '1337',
        itemIds: null,
        data: {status: 'unresolved'},
        query: 'is:resolved'
      });

      expect(this.api._wrapRequest.calledOnce).to.be.ok;
      let requestArgs = this.api._wrapRequest.getCall(0).args[1];
      expect(requestArgs.query).to.eql({query: 'is:resolved'});
    });
  });
});
