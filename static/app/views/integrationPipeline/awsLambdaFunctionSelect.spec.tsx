import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AwsLambdaFunctionSelect from 'sentry/views/integrationPipeline/awsLambdaFunctionSelect';

describe('AwsLambdaFunctionSelect', () => {
  it('choose lambdas', async () => {
    render(
      <AwsLambdaFunctionSelect
        initialStepNumber={0}
        lambdaFunctions={[
          {FunctionName: 'lambdaA', Runtime: 'nodejs12.x'},
          {FunctionName: 'lambdaB', Runtime: 'nodejs10.x'},
          {FunctionName: 'lambdaC', Runtime: 'nodejs10.x'},
        ]}
      />
    );
    expect(screen.getByRole('checkbox', {name: 'lambdaB'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Finish Setup'})).toBeInTheDocument();

    // Uncheck lambda A
    await userEvent.click(screen.getByRole('checkbox', {name: 'lambdaA'}));

    const {promise, resolve} = Promise.withResolvers<FormData>();

    const submitForm = jest.fn((e: SubmitEvent) => {
      e.preventDefault();
      if (e.target instanceof HTMLFormElement) {
        resolve(new FormData(e.target));
      }
    });
    window.addEventListener('submit', submitForm);

    // Submit form
    await userEvent.click(screen.getByRole('button', {name: 'Finish Setup'}));
    expect(submitForm).toHaveBeenCalled();

    // Validate data was passed
    const formData = await promise;
    expect(Object.fromEntries(formData.entries())).toEqual({
      lambdaA: 'false',
      lambdaB: 'true',
      lambdaC: 'true',
    });

    window.removeEventListener('submit', submitForm);
  });
});
