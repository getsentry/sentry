import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {openPipelineModal} from 'sentry/components/pipeline/modal';
import {createMakeStepProps} from 'sentry/components/pipeline/testUtils';
import type {AwsVerificationResult} from 'sentry/utils/seer/awsConnection';

import {awsIntegrationPipeline} from '.';

const organization = OrganizationFixture();
const API_URL = `/organizations/${organization.slug}/pipeline/integration_pipeline/`;
const ROLE_ARN = 'arn:aws:iam::123456789012:role/SentrySeerAccess';
const AwsSetupStep = awsIntegrationPipeline.steps[0].component;
const AwsVerificationStep = awsIntegrationPipeline.steps[2].component;
const makeStepProps = createMakeStepProps({totalSteps: 3});
const setupData = {
  cloudformationUrl:
    'https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?templateURL=https%3A%2F%2Fexample.com%2Ftemplate.json',
  externalId: 'a'.repeat(64),
  sentryPrincipalArn: 'arn:aws:iam::111111111111:role/SentrySeerBroker',
  trustPolicy: '{}',
  permissionPolicy: '{}',
  terraform: 'resource "aws_iam_role" "sentry_seer" {}',
};
const verification: AwsVerificationResult = {
  connectionStatus: 'connected',
  externalIdRequired: true,
  regions: [{region: 'us-east-1', connectionStatus: 'connected', services: []}],
};

describe('AWS integration pipeline', () => {
  it('displays generated trust values and the CloudFormation link', async () => {
    render(<AwsSetupStep {...makeStepProps({stepData: setupData})} />);
    expect(screen.getByDisplayValue(setupData.externalId)).toHaveAttribute('readonly');
    expect(screen.getByDisplayValue(setupData.sentryPrincipalArn)).toHaveAttribute(
      'readonly'
    );
    expect(screen.getByRole('button', {name: 'Open CloudFormation'})).toHaveAttribute(
      'href',
      setupData.cloudformationUrl
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Set up with Terraform or IAM policies'})
    );
    expect(screen.getByText('Terraform')).toBeInTheDocument();
    expect(screen.getByText('Trust Policy')).toBeInTheDocument();
    expect(screen.getByText('Permissions Policy')).toBeInTheDocument();
  });

  it('installs using only role ARN, regions, and verification actions', async () => {
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({action: 'initialize', provider: 'aws'})],
      body: {
        step: 'aws_setup',
        stepIndex: 0,
        totalSteps: 3,
        provider: 'aws',
        data: setupData,
      },
    });
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({})],
      body: {
        status: 'advance',
        step: 'aws_customer_config',
        stepIndex: 1,
        totalSteps: 3,
        provider: 'aws',
        data: {regions: ['us-east-1', 'us-west-2']},
      },
    });
    const configure = MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({roleArn: ROLE_ARN, regions: ['us-east-1']})],
      body: {
        status: 'advance',
        step: 'aws_verification',
        stepIndex: 2,
        totalSteps: 3,
        provider: 'aws',
        data: {verification: null},
      },
    });
    const verify = MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({action: 'verify'})],
      body: {status: 'stay', data: {verification}},
    });
    const integration = OrganizationIntegrationsFixture();
    const finish = MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({action: 'finish'})],
      body: {status: 'complete', data: integration},
    });
    const onComplete = jest.fn();
    renderGlobalModal({organization});
    act(() => openPipelineModal({type: 'integration', provider: 'aws', onComplete}));
    await userEvent.click(await screen.findByRole('button', {name: 'Continue'}));
    await userEvent.type(
      await screen.findByRole('textbox', {name: 'IAM Role ARN'}),
      ` ${ROLE_ARN} `
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'AWS Regions'}),
      'us-east-1'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Finish setup'}));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(integration));
    expect(configure).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({data: {roleArn: ROLE_ARN, regions: ['us-east-1']}})
    );
    expect(verify).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({data: {action: 'verify'}})
    );
    expect(finish).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({data: {action: 'finish'}})
    );
  });

  it('blocks finishing if the external ID is not required, even with connected regions', () => {
    render(
      <AwsVerificationStep
        {...makeStepProps({
          stepData: {verification: {...verification, externalIdRequired: false}},
        })}
      />
    );
    expect(screen.getByRole('button', {name: 'Finish setup'})).toBeDisabled();
    expect(
      screen.getByText(/could not verify that this role requires your external ID/)
    ).toBeInTheDocument();
  });

  it('allows partial region access after verifying the trust policy', () => {
    render(
      <AwsVerificationStep
        {...makeStepProps({
          stepData: {
            verification: {
              ...verification,
              connectionStatus: 'permission_denied',
              regions: [
                ...verification.regions,
                {
                  region: 'us-west-2',
                  connectionStatus: 'permission_denied',
                  services: [
                    {
                      service: 'logs',
                      status: 'permission_denied',
                      errorDetail: 'Grant logs:DescribeLogGroups.',
                    },
                  ],
                },
              ],
            },
          },
        })}
      />
    );
    expect(screen.getByRole('button', {name: 'Finish setup'})).toBeEnabled();
    expect(screen.getByText(/Grant logs:DescribeLogGroups/)).toBeInTheDocument();
    expect(screen.getByText(/Seer will use the connected regions/)).toBeInTheDocument();
  });

  it('starts verification once and supports a retry', async () => {
    const advance = jest.fn();
    const props = makeStepProps({advance, stepData: {verification: null}});
    const {rerender} = render(<AwsVerificationStep {...props} />);
    expect(advance).toHaveBeenCalledWith({action: 'verify'});
    rerender(<AwsVerificationStep {...props} />);
    expect(advance).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', {name: 'Re-test'}));
    expect(advance).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', {name: 'Finish setup'})).toBeDisabled();
  });
});
