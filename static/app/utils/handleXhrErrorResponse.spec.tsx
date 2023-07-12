import * as Sentry from '@sentry/react';

import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import RequestError from 'sentry/utils/requestError/requestError';

describe('handleXhrErrorResponse', function () {
  const stringError = new RequestError('GET', '/api/0', new Error('dead'), {
    status: 400,
    responseText: 'Error message',
    statusText: 'Bad Request',
    getResponseHeader: () => 'application/json',
    responseJSON: {detail: 'Error message'},
  });

  const objError = new RequestError('GET', '/api/0', new Error('dead'), {
    status: 400,
    responseText: 'Error message',
    statusText: 'Bad Request',
    getResponseHeader: () => 'application/json',
    responseJSON: {detail: {code: 'api-err-code', message: 'Error message'}},
  });

  beforeEach(function () {
    jest.clearAllMocks();
  });

  it('does nothing if we have invalid response', function () {
    // cast to invalid type on purpose
    handleXhrErrorResponse('', null as any);
    expect(Sentry.captureException).not.toHaveBeenCalled();
    // cast to invalid type on purpose
    handleXhrErrorResponse('', undefined as any);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('captures an exception to sdk when `resp.detail` is a string', function () {
    handleXhrErrorResponse('String error', stringError);
    expect(Sentry.captureException).toHaveBeenCalledWith(new Error('String error'));
  });

  it('captures an exception to sdk when `resp.detail` is an object', function () {
    handleXhrErrorResponse('Object error', objError);
    expect(Sentry.captureException).toHaveBeenCalledWith(new Error('Object error'));
  });

  it('ignores `sudo-required` errors', function () {
    handleXhrErrorResponse(
      'Sudo required error',
      new RequestError('GET', '/api/0', new Error('dead'), {
        status: 401,
        responseText: 'Sudo required',
        statusText: 'Unauthorized',
        getResponseHeader: () => 'application/json',
        responseJSON: {
          detail: {
            code: 'sudo-required',
            detail: 'Sudo required',
          },
        },
      })
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('adds data to the scope', () => {
    const status = 404;
    const responseJSON = {
      detail: {
        code: 'distracted-by-squirrel',
        detail: 'Got distracted by a squirrel',
      },
    };
    const err = new RequestError('GET', '/ball', new Error('API error'), {
      status,
      getResponseHeader: () => 'application/json',
      statusText: 'Not Found',
      responseText: 'distraced-by-squirrel: Got distracted by a squirrel',
      responseJSON,
    });

    const mockScope = new Sentry.Scope();
    const setExtrasSpy = jest.spyOn(mockScope, 'setExtras');
    const setTagsSpy = jest.spyOn(mockScope, 'setTags');
    const hub = Sentry.getCurrentHub();
    jest.spyOn(hub, 'pushScope').mockReturnValueOnce(mockScope);

    handleXhrErrorResponse("Can't fetch ball", err);

    expect(setExtrasSpy).toHaveBeenCalledWith({status, responseJSON});
    expect(setTagsSpy).toHaveBeenCalledWith({
      responseStatus: status,
      endpoint: 'GET /ball',
    });
  });
});
