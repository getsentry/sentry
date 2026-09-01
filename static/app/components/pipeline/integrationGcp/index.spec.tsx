import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {createMakeStepProps} from 'sentry/components/pipeline/testUtils';

import {gcpIntegrationPipeline} from '.';

const GcpSaGenerationStep = gcpIntegrationPipeline.steps[0].component;
const GcpCustomerConfigStep = gcpIntegrationPipeline.steps[1].component;
const GcpVerificationStep = gcpIntegrationPipeline.steps[2].component;

const makeSaGenerationStepProps = createMakeStepProps({totalSteps: 3});
const makeCustomerConfigStepProps = createMakeStepProps({totalSteps: 3});
const makeVerificationStepProps = createMakeStepProps({totalSteps: 3});

describe('GcpSaGenerationStep', () => {
  const sentrySaEmail = 'sentry-org-123@sentry-connectors.iam.gserviceaccount.com';

  it('renders the setup instructions and SA email', () => {
    render(
      <GcpSaGenerationStep {...makeSaGenerationStepProps({stepData: {sentrySaEmail}})} />
    );

    expect(screen.getByDisplayValue(sentrySaEmail)).toBeInTheDocument();
    expect(screen.getByText('Setup Instructions')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  it('calls advance on continue click', async () => {
    const advance = jest.fn();
    render(
      <GcpSaGenerationStep
        {...makeSaGenerationStepProps({stepData: {sentrySaEmail}, advance})}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    expect(advance).toHaveBeenCalled();
  });

  it('disables continue when initializing', () => {
    render(
      <GcpSaGenerationStep
        {...makeSaGenerationStepProps({stepData: null, isInitializing: true})}
      />
    );

    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
  });

  it('shows busy state when advancing', () => {
    render(
      <GcpSaGenerationStep
        {...makeSaGenerationStepProps({stepData: {sentrySaEmail}, isAdvancing: true})}
      />
    );

    expect(screen.getByRole('button', {name: 'Continue'})).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });
});

describe('GcpCustomerConfigStep', () => {
  it('renders the config form with one empty project input', () => {
    render(<GcpCustomerConfigStep {...makeCustomerConfigStepProps({stepData: {}})} />);

    expect(screen.getByLabelText('Service Account Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('my-gcp-project')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add Project'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  it('adds and removes project inputs', async () => {
    render(<GcpCustomerConfigStep {...makeCustomerConfigStepProps({stepData: {}})} />);

    expect(screen.getAllByPlaceholderText('my-gcp-project')).toHaveLength(1);
    expect(
      screen.queryByRole('button', {name: 'Remove project'})
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Add Project'}));
    expect(screen.getAllByPlaceholderText('my-gcp-project')).toHaveLength(2);
    expect(screen.getAllByRole('button', {name: 'Remove project'})).toHaveLength(2);

    await userEvent.click(screen.getAllByRole('button', {name: 'Remove project'})[0]!);
    expect(screen.getAllByPlaceholderText('my-gcp-project')).toHaveLength(1);
  });

  it('calls advance with config on submit', async () => {
    const advance = jest.fn();
    render(
      <GcpCustomerConfigStep {...makeCustomerConfigStepProps({stepData: {}, advance})} />
    );

    await userEvent.type(
      screen.getByLabelText('Service Account Email'),
      'gcp-sentry@my-project.iam.gserviceaccount.com'
    );

    const projectInputs = screen.getAllByPlaceholderText('my-gcp-project');
    await userEvent.type(projectInputs[0]!, 'my-project-prod');

    await userEvent.click(screen.getByRole('button', {name: 'Add Project'}));
    const updatedInputs = screen.getAllByPlaceholderText('my-gcp-project');
    await userEvent.type(updatedInputs[1]!, 'my-project-staging');

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        customerSaEmail: 'gcp-sentry@my-project.iam.gserviceaccount.com',
        projects: ['my-project-prod', 'my-project-staging'],
      });
    });
  });

  it('shows busy state when isAdvancing', () => {
    render(
      <GcpCustomerConfigStep
        {...makeCustomerConfigStepProps({stepData: {}, isAdvancing: true})}
      />
    );

    expect(screen.getByRole('button', {name: 'Continue'})).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('disables submit button when isInitializing', () => {
    render(
      <GcpCustomerConfigStep
        {...makeCustomerConfigStepProps({stepData: null, isInitializing: true})}
      />
    );

    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
  });
});

describe('GcpVerificationStep', () => {
  const VERIFY_URL =
    '/organizations/org-slug/monitoring-providers/gcp/verify-connection/';

  const stepData = {
    customerSaEmail: 'gcp-sentry@my-project.iam.gserviceaccount.com',
    projects: ['my-project-prod'],
  };

  const connectedResponse = {
    connectionStatus: 'connected',
    projects: [
      {
        gcpProjectId: 'my-project-prod',
        connectionStatus: 'connected',
        services: [
          {service: 'logging', status: 'connected'},
          {service: 'monitoring', status: 'connected'},
          {service: 'cloudtrace', status: 'connected'},
        ],
      },
    ],
  };

  const deniedResponse = {
    connectionStatus: 'permission_denied',
    projects: [
      {
        gcpProjectId: 'my-project-prod',
        connectionStatus: 'permission_denied',
        errorDetail: 'Cloud Trace: IAM roles not granted',
        services: [
          {service: 'logging', status: 'connected'},
          {
            service: 'cloudtrace',
            status: 'permission_denied',
            errorDetail: 'IAM roles not granted',
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows the check running before it has a result, with no way to skip it', async () => {
    MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      body: connectedResponse,
      asyncDelay: 20,
    });

    render(<GcpVerificationStep {...makeVerificationStepProps({stepData})} />);

    // The mutation starts idle, so this covers the gap before the effect fires.
    expect(screen.getByText('Testing your GCP connection...')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Re-test'})).toBeDisabled();

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled()
    );
  });

  it('cannot be advanced twice while the first advance is in flight', async () => {
    MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      body: connectedResponse,
    });

    render(
      <GcpVerificationStep
        {...makeVerificationStepProps({stepData, isAdvancing: true})}
      />
    );

    // Wait for the result, so the check being in flight isn't what disables it.
    expect(await screen.findByText('my-project-prod')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Re-test'})).toBeDisabled();
  });

  it('advances with the result when every project is connected', async () => {
    MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      body: connectedResponse,
    });
    const advance = jest.fn();

    render(<GcpVerificationStep {...makeVerificationStepProps({stepData, advance})} />);

    await userEvent.click(await screen.findByRole('button', {name: 'Continue'}));

    expect(advance).toHaveBeenCalledWith({
      connectionStatus: 'connected',
      projects: [
        {
          gcpProjectId: 'my-project-prod',
          connectionStatus: 'connected',
          errorDetail: null,
        },
      ],
    });
  });

  it('verifies the connection on mount and shows a connected project', async () => {
    const verify = MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      body: connectedResponse,
    });

    render(<GcpVerificationStep {...makeVerificationStepProps({stepData})} />);

    expect(await screen.findByText('my-project-prod')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();

    expect(verify).toHaveBeenCalledWith(
      VERIFY_URL,
      expect.objectContaining({
        method: 'POST',
        data: {
          customerSaEmail: stepData.customerSaEmail,
          gcpProjectIds: stepData.projects,
        },
      })
    );
  });

  it('shows per-service remediation detail when a project fails', async () => {
    MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      body: deniedResponse,
    });

    render(<GcpVerificationStep {...makeVerificationStepProps({stepData})} />);

    expect(await screen.findByText('Permission denied')).toBeInTheDocument();
    expect(screen.getByText('Cloud Trace: IAM roles not granted')).toBeInTheDocument();
    // Services that passed are not listed.
    expect(screen.queryByText(/^Cloud Logging:/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue Anyway'})).toBeEnabled();
  });

  it('advances with the verification result', async () => {
    MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      body: deniedResponse,
    });
    const advance = jest.fn();

    render(<GcpVerificationStep {...makeVerificationStepProps({stepData, advance})} />);

    await userEvent.click(await screen.findByRole('button', {name: 'Continue Anyway'}));

    expect(advance).toHaveBeenCalledWith({
      connectionStatus: 'permission_denied',
      projects: [
        {
          gcpProjectId: 'my-project-prod',
          connectionStatus: 'permission_denied',
          errorDetail: 'Cloud Trace: IAM roles not granted',
        },
      ],
    });
  });

  it('forwards a project detail with no failing services of its own', async () => {
    MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      body: {
        connectionStatus: 'permission_denied',
        errorDetail: 'SA impersonation chain failed',
        projects: [
          {
            gcpProjectId: 'my-project-prod',
            connectionStatus: 'permission_denied',
            errorDetail: 'SA impersonation chain failed',
            services: [
              {
                service: 'logging',
                status: 'permission_denied',
                errorDetail: 'SA impersonation chain failed',
              },
            ],
          },
        ],
      },
    });
    const advance = jest.fn();

    render(<GcpVerificationStep {...makeVerificationStepProps({stepData, advance})} />);

    await userEvent.click(await screen.findByRole('button', {name: 'Continue Anyway'}));

    expect(advance).toHaveBeenCalledWith({
      connectionStatus: 'permission_denied',
      projects: [
        {
          gcpProjectId: 'my-project-prod',
          connectionStatus: 'permission_denied',
          errorDetail: 'SA impersonation chain failed',
        },
      ],
    });
  });

  it('re-tests the connection on demand', async () => {
    const verify = MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      body: deniedResponse,
    });

    render(<GcpVerificationStep {...makeVerificationStepProps({stepData})} />);

    await screen.findByText('Permission denied');
    expect(verify).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', {name: 'Re-test'}));

    await waitFor(() => expect(verify).toHaveBeenCalledTimes(2));
  });

  it('lets the customer finish setup when the check cannot be completed', async () => {
    MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      statusCode: 502,
    });
    const advance = jest.fn();

    render(<GcpVerificationStep {...makeVerificationStepProps({stepData, advance})} />);

    expect(
      await screen.findByText(
        'We could not complete the connection test. You can finish setup and re-test from the integration settings page.'
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Continue Anyway'}));

    expect(advance).toHaveBeenCalledWith({
      connectionStatus: 'error',
      projects: [
        {
          gcpProjectId: 'my-project-prod',
          connectionStatus: 'error',
          errorDetail: 'Verification could not be completed.',
        },
      ],
    });
  });
});

describe('gcpIntegrationPipeline', () => {
  it('has three steps in the correct order', () => {
    expect(gcpIntegrationPipeline.steps).toHaveLength(3);
    expect(gcpIntegrationPipeline.steps[0].stepId).toBe('gcp_sa_generation');
    expect(gcpIntegrationPipeline.steps[1].stepId).toBe('gcp_customer_config');
    expect(gcpIntegrationPipeline.steps[2].stepId).toBe('gcp_verification');
  });
});
