import {logAjaxError} from 'app/utils/logging';
import * as Sentry from '@sentry/browser';

describe('logging', function() {
  describe('logAjaxError()', function() {
    beforeEach(function() {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      Sentry.captureMessage.mockReset();
    });

    afterEach(function() {
      window.console.error.mockRestore();
    });

    it('should handle (Sentry) JSON responses', function() {
      logAjaxError(
        {
          status: 500,
          responseJSON: {detail: 'A bad thing happened'},
        },
        {foo: 'bar'} /* context */
      );

      expect(Sentry.captureMessage).toHaveBeenCalled();
      expect(Sentry.captureMessage.mock.calls[0][0]).toEqual(
        'HTTP 500: A bad thing happened'
      );
    });

    it('should handle text/html responses', function() {
      logAjaxError(
        {
          status: 401,
          responseText: 'You are not authenticated',
        },
        {foo: 'bar'} /* context */
      );

      expect(Sentry.captureMessage).toHaveBeenCalled();
      expect(Sentry.captureMessage.mock.calls[0][0]).toEqual(
        'HTTP 401: You are not authenticated'
      );
    });

    it('should handle responseJSON/responseText undefined (bad content type?)', function() {
      logAjaxError({status: 404}, {foo: 'bar'} /* context */);

      expect(Sentry.captureMessage).toHaveBeenCalled();
      expect(Sentry.captureMessage.mock.calls[0][0]).toEqual(
        'HTTP 404: <unknown response>'
      );
    });
  });
});
