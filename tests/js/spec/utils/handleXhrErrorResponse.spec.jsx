import handleXhrErrorResponse from 'app/utils/handleXhrErrorResponse';
import sdk from 'app/utils/sdk';

jest.mock('app/utils/sdk', () => ({
  captureException: jest.fn(),
}));

describe('handleXhrErrorResponse', function() {
  const stringError = {responseJSON: {detail: 'Error'}, status: 400};
  const objError = {
    status: 400,
    responseJSON: {detail: {code: 'api-err-code', message: 'Error message'}},
  };
  beforeEach(function() {
    sdk.captureException.mockReset();
  });

  it('does nothing if we have invalid response', function() {
    handleXhrErrorResponse('')(null);
    expect(sdk.captureException).not.toHaveBeenCalled();
    handleXhrErrorResponse('')({});
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it('captures an exception to sdk when `resp.detail` is a string', function() {
    handleXhrErrorResponse('String error')(stringError);
    expect(sdk.captureException).toHaveBeenCalledWith(new Error('String error'), {
      status: 400,
      detail: 'Error',
    });
  });

  it('captures an exception to sdk when `resp.detail` is an object', function() {
    handleXhrErrorResponse('Object error')(objError);
    expect(sdk.captureException).toHaveBeenCalledWith(new Error('Object error'), {
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
    expect(sdk.captureException).not.toHaveBeenCalled();
  });
});
