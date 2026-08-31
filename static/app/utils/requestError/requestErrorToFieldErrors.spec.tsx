import {RequestError} from './requestError';
import {requestErrorToFieldErrors} from './requestErrorToFieldErrors';

function createRequestError(responseJSON?: Record<string, unknown>): RequestError {
  const error = new RequestError('POST', '/test/', new Error('test'));
  if (responseJSON) {
    error.responseJSON = responseJSON;
  }
  return error;
}

describe('requestErrorToFieldErrors', () => {
  it('maps string and array values for known fields', () => {
    const error = createRequestError({
      name: 'string error',
      email: ['array error', 'other error'],
      unknownField: ['ignored error'],
    });

    expect(requestErrorToFieldErrors(error, {name: '', email: ''})).toEqual({
      name: {message: 'string error'},
      email: {message: 'array error'},
    });
  });

  it('stringifies non-string array items', () => {
    const error = createRequestError({field: [123]});

    expect(requestErrorToFieldErrors(error, {field: ''})).toEqual({
      field: {message: '123'},
    });
  });

  it('returns no errors when the response has no known fields', () => {
    const error = createRequestError({unknownField: ['ignored error']});

    expect(requestErrorToFieldErrors(error, {name: ''})).toEqual({});
  });

  it('returns no errors when responseJSON is missing', () => {
    expect(requestErrorToFieldErrors(createRequestError(), {name: ''})).toEqual({});
  });
});
