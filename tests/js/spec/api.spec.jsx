import $ from 'jquery';
import {Client, Request} from 'app/api';

describe('api', function () {
  beforeEach(function () {
    this.sandbox = sinon.sandbox.create();

    this.api = new Client();
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
});
