import React from 'react';
import * as qs from 'query-string';

import {mountWithTheme} from 'sentry-test/enzyme';

import AwsLambdaCloudformation from 'app/views/integrationPipeline/awsLambdaCloudformation';

const validArn =
  'arn:aws:cloudformation:us-east-2:599817902985:stack/' +
  'Sentry-Monitoring-Stack-Filter/e42083d0-3e3f-11eb-b66a-0ac9b5db7f30';

describe('AwsLambdaCloudformation', () => {
  let wrapper;
  let windowAssignMock;
  beforeEach(() => {
    windowAssignMock = jest.fn();
    window.location.assign = windowAssignMock;
    window.localStorage.setItem('AWS_EXTERNAL_ID', 'my-id');

    wrapper = mountWithTheme(
      <AwsLambdaCloudformation
        baseCloudformationUrl="https://console.aws.amazon.com/cloudformation/home#/stacks/create/review"
        templateUrl="https://example.com/file.json"
        stackName="Sentry-Monitoring-Stack-Filter"
        arn=""
      />
    );
  });
  it('submit arn', () => {
    wrapper.find('textarea[name="arn"]').simulate('change', {target: {value: validArn}});

    wrapper.find('StyledButton[aria-label="Next"]').simulate('click');

    const {
      location: {origin},
    } = window;

    const query = qs.stringify({
      arn: validArn,
      awsExternalId: 'my-id',
    });

    expect(windowAssignMock).toHaveBeenCalledWith(
      `${origin}/extensions/aws_lambda/setup/?${query}`
    );
  });
});
