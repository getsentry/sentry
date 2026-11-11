import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {createMakeStepProps} from 'sentry/components/pipeline/testUtils';

import {awsIntegrationPipeline} from '.';

const AwsRoleStep = awsIntegrationPipeline.steps[0].component;
const makeStepProps = createMakeStepProps({totalSteps: 1});
const stepData = {
  cloudFormationTemplate: {AWSTemplateFormatVersion: '2010-09-09'},
  externalId: '11111111-1111-4111-8111-111111111111',
  principalArn: 'arn:aws:iam::987654321098:role/SeerWorkload',
  regions: ['us-east-1', 'eu-west-1'],
};

describe('AWS role setup', () => {
  it('shows the organization trust configuration and CloudFormation setup', () => {
    render(<AwsRoleStep {...makeStepProps({stepData})} />);

    expect(screen.getByRole('textbox', {name: 'External ID'})).toHaveValue(
      stepData.externalId
    );
    expect(screen.getByRole('textbox', {name: 'External ID'})).toHaveAttribute(
      'readonly'
    );
    expect(screen.getByRole('textbox', {name: 'Sentry Workload Role'})).toHaveValue(
      stepData.principalArn
    );
    expect(screen.getByRole('button', {name: 'Download template'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Open CloudFormation'})).toHaveAttribute(
      'href',
      'https://console.aws.amazon.com/cloudformation/home#/stacks/create/template'
    );
  });

  it('submits only the role and region for server-side verification', async () => {
    const advance = jest.fn();
    render(<AwsRoleStep {...makeStepProps({stepData, advance})} />);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'IAM Role ARN'}),
      'arn:aws:iam::123456789012:role/SeerTelemetry'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Verify and connect'}));

    await waitFor(() =>
      expect(advance).toHaveBeenCalledWith({
        roleArn: 'arn:aws:iam::123456789012:role/SeerTelemetry',
        region: 'us-east-1',
      })
    );
  });

  it('rejects non-role identities before submitting', async () => {
    const advance = jest.fn();
    render(<AwsRoleStep {...makeStepProps({stepData, advance})} />);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'IAM Role ARN'}),
      'arn:aws:iam::123456789012:root'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Verify and connect'}));

    expect(advance).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', {name: 'IAM Role ARN'})).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  it('waits for the server-generated configuration', () => {
    render(<AwsRoleStep {...makeStepProps({stepData: null, isInitializing: true})} />);
    expect(screen.getByRole('button', {name: 'Verify and connect'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Download template'})).toBeDisabled();
  });
});
