import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {createMakeStepProps} from 'sentry/components/pipeline/testUtils';

import {datadogIntegrationPipeline} from '.';

const DatadogCredentialsStep = datadogIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

describe('DatadogCredentialsStep', () => {
  it('renders the credentials form', () => {
    render(<DatadogCredentialsStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByLabelText('API Key')).toBeInTheDocument();
    expect(screen.getByLabelText('Application Key')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Datadog Site'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  it('calls advance with credentials on submit', async () => {
    const advance = jest.fn();
    render(<DatadogCredentialsStep {...makeStepProps({stepData: {}, advance})} />);

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Datadog Site'}),
      'datadoghq.com (US1)'
    );
    await userEvent.type(screen.getByLabelText('API Key'), 'api-key');
    await userEvent.type(screen.getByLabelText('Application Key'), 'app-key');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        apiKey: 'api-key',
        appKey: 'app-key',
        site: 'datadoghq.com',
      });
    });
  });

  it('shows busy state when isAdvancing', () => {
    render(
      <DatadogCredentialsStep {...makeStepProps({stepData: {}, isAdvancing: true})} />
    );

    expect(screen.getByRole('button', {name: 'Continue'})).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('disables submit button when isInitializing', () => {
    render(
      <DatadogCredentialsStep
        {...makeStepProps({stepData: null, isInitializing: true})}
      />
    );

    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
  });
});
