import Raven from 'raven-js';
import handleXhrErrorResponse from 'app/utils/handleXhrErrorResponse';

jest.mock('raven-js', () => ({
  captureException: jest.fn(),
}));

describe('handleXhrErrorResponse', function() {
  const stringError = {responseJSON: {detail: 'Error'}, status: 400};
  const objError = {
    status: 400,
    responseJSON: {detail: {code: 'api-err-code', message: 'Error message'}},
  };
  beforeEach(function() {
    Raven.captureException.mockReset();
  });

  it('does nothing if we have invalid response', function() {
    handleXhrErrorResponse('')(null);
    expect(Raven.captureException).not.toHaveBeenCalled();
    handleXhrErrorResponse('')({});
    expect(Raven.captureException).not.toHaveBeenCalled();
  });

  it('captures an exception to raven when `resp.detail` is a string', function() {
    handleXhrErrorResponse('String error')(stringError);
    expect(Raven.captureException).toHaveBeenCalledWith(new Error('String error'), {
      status: 400,
      detail: 'Error',
    });
  });

  it('captures an exception to raven when `resp.detail` is an object', function() {
    handleXhrErrorResponse('Object error')(objError);
    expect(Raven.captureException).toHaveBeenCalledWith(new Error('Object error'), {
      status: 400,
      detail: 'Error message',
      code: 'api-err-code',
    });
  });
  it('ignores `sudo-required` errors', function() {
    handleXhrErrorResponse('Sudo required error')({
      status: 401,
      responseJSON: {
        detail: {
          code: 'sudo-required',
          detail: 'Sudo required',
        },
      },
    });
    expect(Raven.captureException).not.toHaveBeenCalled();
  });
});
