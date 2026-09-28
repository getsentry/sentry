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

  it('links key help to the docs until a site is selected', () => {
    render(<DatadogCredentialsStep {...makeStepProps({stepData: {}})} />);

    const docsUrl = 'https://docs.datadoghq.com/account_management/api-app-keys/';
    expect(screen.getByRole('link', {name: /API Keys/})).toHaveAttribute('href', docsUrl);
    expect(screen.getByRole('link', {name: /Application Keys/})).toHaveAttribute(
      'href',
      docsUrl
    );
  });

  it('prefixes app. only for primary sites, not regional ones', async () => {
    render(<DatadogCredentialsStep {...makeStepProps({stepData: {}})} />);

    // Regional sites already carry their region as a subdomain, so no app. prefix.
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Datadog Site'}),
      'us3.datadoghq.com (US3)'
    );
    expect(screen.getByRole('link', {name: /API Keys/})).toHaveAttribute(
      'href',
      'https://us3.datadoghq.com/organization-settings/api-keys'
    );
    expect(screen.getByRole('link', {name: /Application Keys/})).toHaveAttribute(
      'href',
      'https://us3.datadoghq.com/organization-settings/application-keys'
    );

    // Primary sites take the app. prefix.
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Datadog Site'}),
      'datadoghq.com (US1)'
    );
    expect(screen.getByRole('link', {name: /API Keys/})).toHaveAttribute(
      'href',
      'https://app.datadoghq.com/organization-settings/api-keys'
    );
    expect(screen.getByRole('link', {name: /Application Keys/})).toHaveAttribute(
      'href',
      'https://app.datadoghq.com/organization-settings/application-keys'
    );
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
