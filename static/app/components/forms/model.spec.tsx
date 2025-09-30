import * as indicator from 'sentry/actionCreators/indicator';
import FormModel from 'sentry/components/forms/model';

describe('FormModel', () => {
  it('displays error indicators for nonFieldErrors', () => {
    const addErrorMessage = jest.spyOn(indicator, 'addErrorMessage');

    const model = new FormModel();

    model.handleErrorResponse({responseJSON: {nonFieldErrors: ['error message']}});

    expect(addErrorMessage).toHaveBeenCalledWith('error message', {
      duration: 10000,
    });

    model.handleErrorResponse({
      responseJSON: {foo: {nonFieldErrors: ['nested error message']}},
    });

    expect(addErrorMessage).toHaveBeenCalledWith('nested error message', {
      duration: 10000,
    });
  });
});
