import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import AwsLambdaFunctionSelect from 'app/views/integrationPipeline/awsLambdaFunctionSelect';

describe('AwsLambdaFunctionSelect', () => {
  let wrapper;
  let lambdaFunctions;
  let mockRequest;
  beforeEach(() => {
    mockRequest = Client.addMockResponse({
      url: '/extensions/aws_lambda/setup/',
      body: {},
    });

    lambdaFunctions = [
      {FunctionName: 'lambdaA', Runtime: 'nodejs12.x'},
      {FunctionName: 'lambdaB', Runtime: 'nodejs10.x'},
      {FunctionName: 'lambdaC', Runtime: 'nodejs10.x'},
    ];
    wrapper = mountWithTheme(
      <AwsLambdaFunctionSelect lambdaFunctions={lambdaFunctions} />
    );
  });
  it('choose lambdas', () => {
    wrapper.find('button[name="lambdaB"]').simulate('click');
    wrapper.find('StyledButton[aria-label="Finish Setup"]').simulate('click');

    expect(mockRequest).toHaveBeenCalledWith(
      '/extensions/aws_lambda/setup/',
      expect.objectContaining({
        data: {lambdaA: true, lambdaB: false, lambdaC: true},
      })
    );
  });
});
