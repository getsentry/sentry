import * as Sentry from '@sentry/react';

import getXhrErrorResponseHandler from 'sentry/utils/handleXhrErrorResponse';

describe('handleXhrErrorResponse', function () {
  const stringError = {responseJSON: {detail: 'Error'}, status: 400};
  const objError = {
    status: 400,
    responseJSON: {detail: {code: 'api-err-code', message: 'Error message'}},
  };
  beforeEach(function () {
    jest.clearAllMocks();
  });

  it('does nothing if we have invalid response', function () {
    getXhrErrorResponseHandler('')(null);
    expect(Sentry.captureException).not.toHaveBeenCalled();
    getXhrErrorResponseHandler('')({});
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('captures an exception to sdk when `resp.detail` is a string', function () {
    getXhrErrorResponseHandler('String error')(stringError);
    expect(Sentry.captureException).toHaveBeenCalledWith(new Error('String error'));
  });

  it('captures an exception to sdk when `resp.detail` is an object', function () {
    getXhrErrorResponseHandler('Object error')(objError);
    expect(Sentry.captureException).toHaveBeenCalledWith(new Error('Object error'));
  });
  it('ignores `sudo-required` errors', function () {
    getXhrErrorResponseHandler('Sudo required error')({
      status: 401,
      responseJSON: {
        detail: {
          code: 'sudo-required',
          detail: 'Sudo required',
        },
      },
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
