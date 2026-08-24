import {toFieldErrors} from '@sentry/scraps/form';

import {RequestError} from 'sentry/utils/requestError/requestError';

function createMockFormContext(values: Record<string, unknown>) {
  type CreateValidationError = Parameters<
    typeof toFieldErrors
  >[0]['createValidationError'];
  const createValidationError = jest.fn(
    (error: unknown) => error
  ) as unknown as CreateValidationError;

  return {
    createValidationError,
    value: values,
  };
}

function createRequestError(responseJSON?: Record<string, unknown>): RequestError {
  const error = new RequestError('POST', '/test/', new Error('test'));
  if (responseJSON) {
    error.responseJSON = responseJSON;
  }
  return error;
}

describe('toFieldErrors', () => {
  describe('with FieldErrors object', () => {
    it('returns field errors through createValidationError', () => {
      const context = createMockFormContext({name: '', email: ''});
      const errors = {name: {message: 'Name is required'}};

      expect(toFieldErrors(context, errors)).toEqual({fields: errors});
      expect(context.createValidationError).toHaveBeenCalledWith({fields: errors});
    });
  });

  describe('with RequestError', () => {
    it('handles string values', () => {
      const context = createMockFormContext({fieldName: ''});
      const error = createRequestError({fieldName: 'error message'});

      expect(toFieldErrors(context, error)).toEqual({
        fields: {fieldName: {message: 'error message'}},
      });
    });

    it('handles array values by taking the first element', () => {
      const context = createMockFormContext({fieldName: ''});
      const error = createRequestError({fieldName: ['first error', 'second']});

      expect(toFieldErrors(context, error)).toEqual({
        fields: {fieldName: {message: 'first error'}},
      });
    });

    it('only returns errors for known fields', () => {
      const context = createMockFormContext({name: '', email: ''});
      const error = createRequestError({
        name: ['err'],
        unknown_field: ['err'],
      });

      expect(toFieldErrors(context, error)).toEqual({
        fields: {name: {message: 'err'}},
      });
    });

    it('returns undefined when responseJSON is missing', () => {
      const context = createMockFormContext({name: ''});
      const error = createRequestError();

      expect(toFieldErrors(context, error)).toBeUndefined();
      expect(context.createValidationError).not.toHaveBeenCalled();
    });

    it('returns undefined when responseJSON is empty', () => {
      const context = createMockFormContext({name: ''});
      const error = createRequestError({});

      expect(toFieldErrors(context, error)).toBeUndefined();
      expect(context.createValidationError).not.toHaveBeenCalled();
    });

    it('handles mixed field types (string and array)', () => {
      const context = createMockFormContext({name: '', email: ''});
      const error = createRequestError({
        name: 'string error',
        email: ['array error'],
      });

      expect(toFieldErrors(context, error)).toEqual({
        fields: {
          name: {message: 'string error'},
          email: {message: 'array error'},
        },
      });
    });

    it('stringifies non-string array items', () => {
      const context = createMockFormContext({field: ''});
      const error = createRequestError({field: [123]});

      expect(toFieldErrors(context, error)).toEqual({
        fields: {field: {message: '123'}},
      });
    });
  });
});
