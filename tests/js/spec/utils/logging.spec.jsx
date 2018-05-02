import {logAjaxError} from 'app/utils/logging';
import Raven from 'raven-js';

describe('logging', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();

    sandbox.stub(Raven, 'captureMessage');
    sandbox.stub(window.console, 'error');
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('logAjaxError()', function() {
    it('should handle (Sentry) JSON responses', function() {
      logAjaxError(
        {
          status: 500,
          responseJSON: {detail: 'A bad thing happened'},
        },
        {foo: 'bar'} /* context */
      );

      expect(Raven.captureMessage.calledOnce).toBeTruthy();
      expect(Raven.captureMessage.getCall(0).args[0]).toEqual(
        'HTTP 500: A bad thing happened'
      );
      expect(Raven.captureMessage.getCall(0).args[1].extra).toEqual({foo: 'bar'});
    });

    it('should handle text/html responses', function() {
      logAjaxError(
        {
          status: 401,
          responseText: 'You are not authenticated',
        },
        {foo: 'bar'} /* context */
      );

      expect(Raven.captureMessage.calledOnce).toBeTruthy();
      expect(Raven.captureMessage.getCall(0).args[0]).toEqual(
        'HTTP 401: You are not authenticated'
      );
      expect(Raven.captureMessage.getCall(0).args[1].extra).toEqual({foo: 'bar'});
    });

    it('should handle responseJSON/responseText undefined (bad content type?)', function() {
      logAjaxError({status: 404}, {foo: 'bar'} /* context */);

      expect(Raven.captureMessage.calledOnce).toBeTruthy();
      expect(Raven.captureMessage.getCall(0).args[0]).toEqual(
        'HTTP 404: <unknown response>'
      );
      expect(Raven.captureMessage.getCall(0).args[1].extra).toEqual({foo: 'bar'});
    });
  });
});
