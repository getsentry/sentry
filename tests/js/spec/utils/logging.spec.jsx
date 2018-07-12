import {logAjaxError} from 'app/utils/logging';
import sdk from 'app/utils/sdk';

describe('logging', function() {
  describe('logAjaxError()', function() {
    beforeEach(function() {
      sdk.captureMessage.mockReset();
    });

    it('should handle (Sentry) JSON responses', function() {
      logAjaxError(
        {
          status: 500,
          responseJSON: {detail: 'A bad thing happened'},
        },
        {foo: 'bar'} /* context */
      );

      expect(sdk.captureMessage).toHaveBeenCalled();
      expect(sdk.captureMessage.mock.calls[0][0]).toEqual(
        'HTTP 500: A bad thing happened'
      );
      expect(sdk.captureMessage.mock.calls[0][1].extra).toEqual({foo: 'bar'});
    });

    it('should handle text/html responses', function() {
      logAjaxError(
        {
          status: 401,
          responseText: 'You are not authenticated',
        },
        {foo: 'bar'} /* context */
      );

      expect(sdk.captureMessage).toHaveBeenCalled();
      expect(sdk.captureMessage.mock.calls[0][0]).toEqual(
        'HTTP 401: You are not authenticated'
      );
      expect(sdk.captureMessage.mock.calls[0][1].extra).toEqual({foo: 'bar'});
    });

    it('should handle responseJSON/responseText undefined (bad content type?)', function() {
      logAjaxError({status: 404}, {foo: 'bar'} /* context */);

      expect(sdk.captureMessage).toHaveBeenCalled();
      expect(sdk.captureMessage.mock.calls[0][0]).toEqual('HTTP 404: <unknown response>');
      expect(sdk.captureMessage.mock.calls[0][1].extra).toEqual({foo: 'bar'});
    });
  });
});
