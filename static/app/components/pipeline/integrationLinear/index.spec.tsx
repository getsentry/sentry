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
import {
  createMakeStepProps,
  dispatchPipelineMessage,
  setupMockPopup,
} from 'sentry/components/pipeline/testUtils';

import {linearIntegrationPipeline} from '.';

const organization = OrganizationFixture();
const API_URL = `/organizations/${organization.slug}/pipeline/integration_pipeline/`;
const OAUTH_URL = 'https://linear.app/oauth/authorize?client_id=sentry-app-id&actor=app';
const LinearOAuthLoginStep = linearIntegrationPipeline.steps[0].component;
const makeStepProps = createMakeStepProps({totalSteps: 1});

function mockInitialization() {
  return MockApiClient.addMockResponse({
    url: API_URL,
    method: 'POST',
    match: [MockApiClient.matchData({action: 'initialize', provider: 'linear'})],
    body: {
      step: 'oauth_login',
      stepIndex: 0,
      totalSteps: 1,
      provider: 'linear',
      data: {oauthUrl: OAUTH_URL},
    },
  });
}

describe('Linear integration pipeline', () => {
  let mockPopup: Window;

  beforeEach(() => {
    mockPopup = setupMockPopup();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('installs through the registered pipeline using an authorization code', async () => {
    mockInitialization();
    const integration = OrganizationIntegrationsFixture();
    const onComplete = jest.fn();
    const install = MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({code: 'linear-code', state: 'pipeline-state'})],
      body: {status: 'complete', data: integration},
    });
    renderGlobalModal({organization});

    act(() => openPipelineModal({type: 'integration', provider: 'linear', onComplete}));
    await userEvent.click(await screen.findByRole('button', {name: 'Authorize Linear'}));
    expect(window.open).toHaveBeenCalledWith(
      OAUTH_URL,
      'pipeline_popup',
      expect.any(String)
    );
    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'linear-code',
        state: 'pipeline-state',
      },
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(integration));
    expect(install).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({data: {code: 'linear-code', state: 'pipeline-state'}})
    );
  });

  it('shows connection errors and allows another authorization attempt', async () => {
    const initialize = mockInitialization();
    const onComplete = jest.fn();
    const message = 'Linear authorization failed. Authorize your workspace again.';
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({code: 'expired-code', state: 'pipeline-state'})],
      statusCode: 400,
      body: {status: 'error', data: {detail: message}},
    });
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({code: 'new-code', state: 'pipeline-state'})],
      body: {status: 'complete', data: OrganizationIntegrationsFixture()},
    });
    renderGlobalModal({organization});

    act(() => openPipelineModal({type: 'integration', provider: 'linear', onComplete}));
    await userEvent.click(await screen.findByRole('button', {name: 'Authorize Linear'}));
    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'expired-code',
        state: 'pipeline-state',
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    await userEvent.click(screen.getByRole('button', {name: 'Authorize Linear'}));
    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'new-code',
        state: 'pipeline-state',
      },
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('explains cancellation without submitting an empty authorization code', async () => {
    const advance = jest.fn();
    render(
      <LinearOAuthLoginStep
        {...makeStepProps({stepData: {oauthUrl: OAUTH_URL}, advance})}
      />
    );
    await userEvent.click(screen.getByRole('button', {name: 'Authorize Linear'}));
    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        error: 'access_denied',
        state: 'pipeline-state',
      },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Linear authorization was canceled.'
    );
    expect(advance).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Authorize Linear'})).toBeEnabled();
  });

  it('disables authorization until the URL is ready', () => {
    render(<LinearOAuthLoginStep {...makeStepProps({stepData: {}})} />);
    expect(screen.getByRole('button', {name: 'Authorize Linear'})).toBeDisabled();
  });
});
