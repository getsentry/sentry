import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {perforceIntegrationPipeline} from './pipelineIntegrationPerforce';
import {createMakeStepProps} from './testUtils';

const PerforceInstallationConfigStep = perforceIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

describe('PerforceInstallationConfigStep', () => {
  it('renders the config form', () => {
    render(<PerforceInstallationConfigStep {...makeStepProps({stepData: {}})} />);

    expect(
      screen.getByRole('textbox', {name: 'P4PORT (Server Address)'})
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Perforce Username'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Connect'})).toBeInTheDocument();
  });

  it('calls advance with form data on submit', async () => {
    const advance = jest.fn();
    render(
      <PerforceInstallationConfigStep {...makeStepProps({stepData: {}, advance})} />
    );

    await userEvent.type(
      screen.getByRole('textbox', {name: 'P4PORT (Server Address)'}),
      'ssl:perforce.example.com:1666'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Perforce Username'}),
      'sentry-bot'
    );
    await userEvent.type(screen.getByLabelText('Password / Ticket'), 'secret123');
    await userEvent.type(
      screen.getByRole('textbox', {name: 'SSL Fingerprint'}),
      'AB:CD:EF'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Connect'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        p4port: 'ssl:perforce.example.com:1666',
        user: 'sentry-bot',
        authType: 'password',
        password: 'secret123',
        client: undefined,
        sslFingerprint: 'AB:CD:EF',
        webUrl: undefined,
      });
    });
  });

  it('requires sslFingerprint when p4port is ssl', async () => {
    const advance = jest.fn();
    render(
      <PerforceInstallationConfigStep {...makeStepProps({stepData: {}, advance})} />
    );

    await userEvent.type(
      screen.getByRole('textbox', {name: 'P4PORT (Server Address)'}),
      'ssl:perforce.example.com:1666'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Perforce Username'}),
      'sentry-bot'
    );
    await userEvent.type(screen.getByLabelText('Password / Ticket'), 'secret123');
    await userEvent.click(screen.getByRole('button', {name: 'Connect'}));

    expect(
      await screen.findByText('SSL fingerprint is required when P4PORT uses ssl:')
    ).toBeInTheDocument();
    expect(advance).not.toHaveBeenCalled();
  });

  it('includes optional fields when provided', async () => {
    const advance = jest.fn();
    render(
      <PerforceInstallationConfigStep {...makeStepProps({stepData: {}, advance})} />
    );

    await userEvent.type(
      screen.getByRole('textbox', {name: 'P4PORT (Server Address)'}),
      'ssl:p4.example.com:1666'
    );
    await userEvent.type(screen.getByRole('textbox', {name: 'Perforce Username'}), 'bot');
    await userEvent.type(screen.getByLabelText('Password / Ticket'), 'pass');
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Perforce Client/Workspace'}),
      'my-workspace'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'SSL Fingerprint'}),
      'AB:CD:EF'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'P4 Code Review URL'}),
      'https://swarm.example.com'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Connect'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        p4port: 'ssl:p4.example.com:1666',
        user: 'bot',
        authType: 'password',
        password: 'pass',
        client: 'my-workspace',
        sslFingerprint: 'AB:CD:EF',
        webUrl: 'https://swarm.example.com',
      });
    });
  });

  it('shows loading state when isAdvancing', () => {
    render(
      <PerforceInstallationConfigStep
        {...makeStepProps({stepData: {}, isAdvancing: true})}
      />
    );

    expect(screen.getByRole('button', {name: 'Connecting...'})).toBeDisabled();
  });

  it('disables submit button when isInitializing', () => {
    render(
      <PerforceInstallationConfigStep
        {...makeStepProps({stepData: null, isInitializing: true})}
      />
    );

    expect(screen.getByRole('button', {name: 'Connect'})).toBeDisabled();
  });
});
