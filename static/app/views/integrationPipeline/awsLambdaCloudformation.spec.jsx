import selectEvent from 'react-select-event';
import * as qs from 'query-string';

import {fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AwsLambdaCloudformation from 'sentry/views/integrationPipeline/awsLambdaCloudformation';

describe('AwsLambdaCloudformation', () => {
  let windowAssignMock;

  beforeEach(() => {
    windowAssignMock = jest.fn();
    window.location.assign = windowAssignMock;
    window.localStorage.setItem('AWS_EXTERNAL_ID', 'my-id');
  });

  it('submit arn', async () => {
    render(
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

    // Open configuration fields
    userEvent.click(screen.getByRole('button', {name: "I've created the stack"}));

    // XXX(epurkhiser): This form is pretty wonky with how it works, and
    // probably needs cleaned up again in the future. I couldn't get
    // userEvent.type to work here because of something relating to the
    // validation I think.

    // Fill out fields
    const accountNumber = screen.getByRole('textbox', {name: 'AWS Account Number'});
    fireEvent.change(accountNumber, {target: {value: '599817902985'}});

    await selectEvent.select(screen.getByRole('textbox', {name: 'AWS Region'}), [
      ['us-west-1'],
    ]);

    expect(screen.getByRole('button', {name: 'Next'})).toBeEnabled();
    userEvent.click(screen.getByRole('button', {name: 'Next'}));

    const query = qs.stringify({
      accountNumber: '599817902985',
      region: 'us-west-1',
      awsExternalId: 'my-id',
    });

    expect(windowAssignMock).toHaveBeenCalledWith(
      `${window.location.origin}/extensions/aws_lambda/setup/?${query}`
    );
  });
});
