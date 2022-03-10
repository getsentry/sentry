import {render, screen} from 'sentry-test/reactTestingLibrary';

import AwsLambdaFunctionSelect from 'sentry/views/integrationPipeline/awsLambdaFunctionSelect';

describe('AwsLambdaFunctionSelect', () => {
  it('choose lambdas', () => {
    const {container} = render(
      <AwsLambdaFunctionSelect
        lambdaFunctions={[
          {FunctionName: 'lambdaA', Runtime: 'nodejs12.x'},
          {FunctionName: 'lambdaB', Runtime: 'nodejs10.x'},
          {FunctionName: 'lambdaC', Runtime: 'nodejs10.x'},
        ]}
      />
    );
    expect(container).toSnapshot();
    expect(screen.getByLabelText('lambdaB')).toBeInTheDocument();
    expect(screen.getByLabelText('Finish Setup')).toBeInTheDocument();
    // TODO: add assertion for form post
  });
});
