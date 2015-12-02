import {Client, Request} from 'app/api';

describe('api', function () {
  beforeEach(function () {
    this.sandbox = sinon.sandbox.create();
    this.api = new Client();
  });

  describe('Client', function () {
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
});
