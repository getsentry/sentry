import {logAjaxError} from 'app/utils/logging';
import Raven from 'raven-js';

describe('logging', function () {
  beforeEach(function () {
    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(Raven, 'captureMessage');
    this.sandbox.stub(window.console, 'error');
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe('logAjaxError()', function () {
    it('should handle (Sentry) JSON responses', function () {
      logAjaxError({
        status: 500,
        responseJSON: {detail: 'A bad thing happened'}
      }, {foo: 'bar'} /* context */);

      expect(Raven.captureMessage.calledOnce).to.be.ok;
      expect(Raven.captureMessage.getCall(0).args[0]).to.eql('HTTP 500: A bad thing happened');
      expect(Raven.captureMessage.getCall(0).args[1].extra).to.eql({foo: 'bar'});
    });

    it('should handle text/html responses', function () {
      logAjaxError({
        status: 401,
        responseText: 'You are not authenticated'
      }, {foo: 'bar'} /* context */);

      expect(Raven.captureMessage.calledOnce).to.be.ok;
      expect(Raven.captureMessage.getCall(0).args[0]).to.eql('HTTP 401: You are not authenticated');
      expect(Raven.captureMessage.getCall(0).args[1].extra).to.eql({foo: 'bar'});
    });

    it('should handle responseJSON/responseText undefined (bad content type?)', function () {
      logAjaxError({status: 404}, {foo: 'bar'} /* context */);

      expect(Raven.captureMessage.calledOnce).to.be.ok;
      expect(Raven.captureMessage.getCall(0).args[0]).to.eql('HTTP 404: <unknown response>');
      expect(Raven.captureMessage.getCall(0).args[1].extra).to.eql({foo: 'bar'});
    });
  });
});