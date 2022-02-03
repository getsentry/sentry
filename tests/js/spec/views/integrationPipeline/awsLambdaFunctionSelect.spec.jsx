import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import AwsLambdaFunctionSelect from 'sentry/views/integrationPipeline/awsLambdaFunctionSelect';

describe('AwsLambdaFunctionSelect', () => {
  let lambdaFunctions, container;
  beforeEach(() => {
    lambdaFunctions = [
      {FunctionName: 'lambdaA', Runtime: 'nodejs12.x'},
      {FunctionName: 'lambdaB', Runtime: 'nodejs10.x'},
      {FunctionName: 'lambdaC', Runtime: 'nodejs10.x'},
    ];
    ({container} = mountWithTheme(
      <AwsLambdaFunctionSelect lambdaFunctions={lambdaFunctions} />
    ));
  });
  it('choose lambdas', () => {
    expect(container).toSnapshot();
    expect(screen.getByLabelText('lambdaB')).toBeInTheDocument();
    expect(screen.getByLabelText('Finish Setup')).toBeInTheDocument();
    // TODO: add assertion for form post
  });
});
