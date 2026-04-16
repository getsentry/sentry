import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {opsgenieIntegrationPipeline} from './pipelineIntegrationOpsgenie';
import {createMakeStepProps} from './testUtils';

const OpsgenieInstallationConfigStep = opsgenieIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

const baseUrlChoices = [
  {value: 'https://api.opsgenie.com/', label: 'api.opsgenie.com'},
  {value: 'https://api.eu.opsgenie.com/', label: 'api.eu.opsgenie.com'},
];

describe('OpsgenieInstallationConfigStep', () => {
  it('renders the config form', () => {
    render(
      <OpsgenieInstallationConfigStep {...makeStepProps({stepData: {baseUrlChoices}})} />
    );

    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Account Name'})).toBeInTheDocument();
  });

  it('calls advance with form data on submit', async () => {
    const advance = jest.fn();
    render(
      <OpsgenieInstallationConfigStep
        {...makeStepProps({stepData: {baseUrlChoices}, advance})}
      />
    );

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Account Name'}),
      'cool-name'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Opsgenie Integration Key'}),
      '123-key'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        baseUrl: 'https://api.opsgenie.com/',
        provider: 'cool-name',
        apiKey: '123-key',
      });
    });
  });

  it('submits without api key when left empty', async () => {
    const advance = jest.fn();
    render(
      <OpsgenieInstallationConfigStep
        {...makeStepProps({stepData: {baseUrlChoices}, advance})}
      />
    );

    await userEvent.type(screen.getByRole('textbox', {name: 'Account Name'}), 'my-app');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        baseUrl: 'https://api.opsgenie.com/',
        provider: 'my-app',
        apiKey: undefined,
      });
    });
  });

  it('shows loading state when isAdvancing', () => {
    render(
      <OpsgenieInstallationConfigStep
        {...makeStepProps({stepData: {baseUrlChoices}, isAdvancing: true})}
      />
    );

    expect(screen.getByRole('button', {name: 'Submitting...'})).toBeDisabled();
  });
});
