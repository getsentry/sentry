import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {createMakeStepProps} from 'sentry/components/pipeline/testUtils';

import {gcpIntegrationPipeline} from '.';

const GcpSaGenerationStep = gcpIntegrationPipeline.steps[0].component;
const GcpCustomerConfigStep = gcpIntegrationPipeline.steps[1].component;

const makeSaGenerationStepProps = createMakeStepProps({totalSteps: 2});
const makeCustomerConfigStepProps = createMakeStepProps({totalSteps: 2});

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

describe('gcpIntegrationPipeline', () => {
  it('has two steps in the correct order', () => {
    expect(gcpIntegrationPipeline.steps).toHaveLength(2);
    expect(gcpIntegrationPipeline.steps[0].stepId).toBe('gcp_sa_generation');
    expect(gcpIntegrationPipeline.steps[1].stepId).toBe('gcp_customer_config');
  });
});
