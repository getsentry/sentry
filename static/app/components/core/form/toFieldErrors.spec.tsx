import {toFieldErrors} from '@sentry/scraps/form';

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

describe('toFieldErrors', () => {
  it('returns field errors through createValidationError', () => {
    const context = createMockFormContext({name: '', email: ''});
    const errors = {name: {message: 'Name is required'}};

    expect(toFieldErrors(context, errors)).toEqual({fields: errors});
    expect(context.createValidationError).toHaveBeenCalledWith({fields: errors});
  });

  it('returns undefined for an empty field error object', () => {
    const context = createMockFormContext({name: ''});

    expect(toFieldErrors(context, {})).toBeUndefined();
    expect(context.createValidationError).not.toHaveBeenCalled();
  });
});
