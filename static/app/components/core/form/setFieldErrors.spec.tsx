import {setFieldErrors} from '@sentry/scraps/form';

function createMockFormApi(values: Record<string, unknown>) {
  return {
    setErrorMap: jest.fn(),
    state: {values},
  };
}

describe('setFieldErrors', () => {
  it('sets field errors via setErrorMap', () => {
    const formApi = createMockFormApi({name: '', email: ''});
    const errors = {name: {message: 'Name is required'}};

    expect(setFieldErrors(formApi, errors)).toBe(true);

    expect(formApi.setErrorMap).toHaveBeenCalledWith({
      onSubmit: {fields: errors},
    });
  });

  it('does not set an empty field error object', () => {
    const formApi = createMockFormApi({name: ''});

    expect(setFieldErrors(formApi, {})).toBe(false);
    expect(formApi.setErrorMap).not.toHaveBeenCalled();
  });
});
