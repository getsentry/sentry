import {setFieldErrors} from '@sentry/scraps/form';

import {RequestError} from 'sentry/utils/requestError/requestError';

function createMockFormApi(values: Record<string, unknown>) {
  return {
    setErrorMap: jest.fn(),
    state: {values},
  };
}

function createRequestError(responseJSON?: Record<string, unknown>): RequestError {
  const error = new RequestError('POST', '/test/', new Error('test'));
  if (responseJSON) {
    error.responseJSON = responseJSON;
  }
  return error;
}

describe('setFieldErrors', () => {
  describe('with FieldErrors object', () => {
    it('sets field errors directly via setErrorMap', () => {
      const formApi = createMockFormApi({name: '', email: ''});
      const errors = {name: {message: 'Name is required'}};

      setFieldErrors(formApi, errors);

      expect(formApi.setErrorMap).toHaveBeenCalledWith({
        onSubmit: {fields: errors},
      });
    });
  });

  describe('with RequestError', () => {
    it('handles string values', () => {
      const formApi = createMockFormApi({fieldName: ''});
      const error = createRequestError({fieldName: 'error message'});

      setFieldErrors(formApi, error);

      expect(formApi.setErrorMap).toHaveBeenCalledWith({
        onSubmit: {fields: {fieldName: {message: 'error message'}}},
      });
    });

    it('handles array values by taking the first element', () => {
      const formApi = createMockFormApi({fieldName: ''});
      const error = createRequestError({fieldName: ['first error', 'second']});

      setFieldErrors(formApi, error);

      expect(formApi.setErrorMap).toHaveBeenCalledWith({
        onSubmit: {fields: {fieldName: {message: 'first error'}}},
      });
    });

    it('only sets errors for known fields', () => {
      const formApi = createMockFormApi({name: '', email: ''});
      const error = createRequestError({
        name: ['err'],
        unknown_field: ['err'],
      });

      setFieldErrors(formApi, error);

      expect(formApi.setErrorMap).toHaveBeenCalledWith({
        onSubmit: {fields: {name: {message: 'err'}}},
      });
    });

    it('does not set errors when responseJSON is missing', () => {
      const formApi = createMockFormApi({name: ''});
      const error = createRequestError();

      setFieldErrors(formApi, error);

      expect(formApi.setErrorMap).not.toHaveBeenCalled();
    });

    it('does not set errors when responseJSON is empty', () => {
      const formApi = createMockFormApi({name: ''});
      const error = createRequestError({});

      setFieldErrors(formApi, error);

      expect(formApi.setErrorMap).not.toHaveBeenCalled();
    });

    it('handles mixed field types (string and array)', () => {
      const formApi = createMockFormApi({name: '', email: ''});
      const error = createRequestError({
        name: 'string error',
        email: ['array error'],
      });

      setFieldErrors(formApi, error);

      expect(formApi.setErrorMap).toHaveBeenCalledWith({
        onSubmit: {
          fields: {
            name: {message: 'string error'},
            email: {message: 'array error'},
          },
        },
      });
    });

    it('stringifies non-string array items', () => {
      const formApi = createMockFormApi({field: ''});
      const error = createRequestError({field: [123]});

      setFieldErrors(formApi, error);

      expect(formApi.setErrorMap).toHaveBeenCalledWith({
        onSubmit: {fields: {field: {message: '123'}}},
      });
    });
  });
});
