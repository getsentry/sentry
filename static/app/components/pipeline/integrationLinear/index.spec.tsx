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

import {openPipelineModal} from 'sentry/components/pipeline/modal';
import {createMakeStepProps} from 'sentry/components/pipeline/testUtils';

import {linearIntegrationPipeline} from '.';

const organization = OrganizationFixture();
const API_URL = `/organizations/${organization.slug}/pipeline/integration_pipeline/`;
const LinearCredentialsStep = linearIntegrationPipeline.steps[0].component;
const makeStepProps = createMakeStepProps({totalSteps: 1});

function mockInitialization() {
  return MockApiClient.addMockResponse({
    url: API_URL,
    method: 'POST',
    match: [MockApiClient.matchData({action: 'initialize', provider: 'linear'})],
    body: {
      step: 'linear_credentials',
      stepIndex: 0,
      totalSteps: 1,
      provider: 'linear',
      data: {},
    },
  });
}

describe('Linear integration pipeline', () => {
  it('installs through the registered pipeline with a trimmed API key', async () => {
    mockInitialization();
    const integration = OrganizationIntegrationsFixture();
    const onComplete = jest.fn();
    const install = MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({apiKey: 'lin_api_key'})],
      body: {status: 'complete', data: integration},
    });
    renderGlobalModal({organization});

    act(() => openPipelineModal({type: 'integration', provider: 'linear', onComplete}));

    const apiKey = await screen.findByLabelText('API key');
    expect(apiKey).toHaveAttribute('type', 'password');
    await userEvent.type(apiKey, '  lin_api_key  ');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(integration));
    expect(install).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({data: {apiKey: 'lin_api_key'}})
    );
  });

  it('shows connection errors and retries without restarting the pipeline', async () => {
    const initialize = mockInitialization();
    const onComplete = jest.fn();
    const message =
      'Linear rejected the API key. Check that it is an active personal API key.';
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({apiKey: 'lin_api_bad'})],
      statusCode: 400,
      body: {status: 'error', data: {detail: message}},
    });
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({apiKey: 'lin_api_corrected'})],
      body: {status: 'complete', data: OrganizationIntegrationsFixture()},
    });
    renderGlobalModal({organization});

    act(() => openPipelineModal({type: 'integration', provider: 'linear', onComplete}));

    await userEvent.type(await screen.findByLabelText('API key'), 'lin_api_bad');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    await userEvent.clear(screen.getByLabelText('API key'));
    await userEvent.type(screen.getByLabelText('API key'), 'lin_api_corrected');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('requires an API key', async () => {
    const advance = jest.fn();
    render(<LinearCredentialsStep {...makeStepProps({stepData: {}, advance})} />);

    await userEvent.click(screen.getByLabelText('API key'));
    await userEvent.paste('   ');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(advance).not.toHaveBeenCalled();
  });
});
