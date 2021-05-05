import * as qs from 'query-string';

import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import AwsLambdaCloudformation from 'app/views/integrationPipeline/awsLambdaCloudformation';

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
        stackName="Sentry-Monitoring-Stack"
        regionList={['us-east-1', 'us-west-1']}
        accountNumber=""
        region=""
        initialStepNumber={0}
      />
    );
  });
  it('submit arn', async () => {
    wrapper.find('button[name="showInputs"]').simulate('click');

    wrapper
      .find('input[name="accountNumber"]')
      .simulate('change', {target: {value: '599817902985'}});

    selectByValue(wrapper, 'us-west-1');

    await tick();

    wrapper.find('StyledButton[aria-label="Next"]').simulate('click');

    const {
      location: {origin},
    } = window;

    const query = qs.stringify({
      accountNumber: '599817902985',
      region: 'us-west-1',
      awsExternalId: 'my-id',
    });

    expect(windowAssignMock).toHaveBeenCalledWith(
      `${origin}/extensions/aws_lambda/setup/?${query}`
    );
  });
});
