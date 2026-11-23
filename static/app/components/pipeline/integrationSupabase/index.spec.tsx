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

import {supabaseIntegrationPipeline} from '.';

const organization = OrganizationFixture();
const API_URL = `/organizations/${organization.slug}/pipeline/integration_pipeline/`;
const OAUTH_URL = 'https://api.supabase.com/v1/oauth/authorize?client_id=sentry-app-id';
const SupabaseOAuthLoginStep = supabaseIntegrationPipeline.steps[0].component;
const makeStepProps = createMakeStepProps({totalSteps: 1});
const integration = OrganizationIntegrationsFixture({
  name: 'Supabase (Example)',
  externalId: 'org-slug',
  provider: {
    key: 'supabase',
    slug: 'supabase',
    name: 'Supabase',
    canAdd: true,
    canDisable: false,
    features: ['seer-context'],
    aspects: {},
  },
  configData: {},
});

function mockInitialization() {
  return MockApiClient.addMockResponse({
    url: API_URL,
    method: 'POST',
    match: [MockApiClient.matchData({action: 'initialize', provider: 'supabase'})],
    body: {
      step: 'oauth_login',
      stepIndex: 0,
      totalSteps: 1,
      provider: 'supabase',
      data: {oauthUrl: OAUTH_URL},
    },
  });
}

describe('Supabase integration pipeline', () => {
  let mockPopup: Window;

  beforeEach(() => {
    mockPopup = setupMockPopup();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('installs through the registered pipeline using an authorization code', async () => {
    mockInitialization();
    const onComplete = jest.fn();
    const install = MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({code: 'supabase-code', state: 'pipeline-state'})],
      body: {status: 'complete', data: integration},
    });
    renderGlobalModal({organization});

    act(() => openPipelineModal({type: 'integration', provider: 'supabase', onComplete}));
    await userEvent.click(
      await screen.findByRole('button', {name: 'Authorize Supabase'})
    );
    expect(
      screen.getByText(/which a Supabase organization owner must authorize/)
    ).toBeInTheDocument();
    expect(window.open).toHaveBeenCalledWith(
      OAUTH_URL,
      'pipeline_popup',
      expect.any(String)
    );
    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'supabase-code',
        state: 'pipeline-state',
      },
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(integration));
    expect(install).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({data: {code: 'supabase-code', state: 'pipeline-state'}})
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows connection errors and allows another authorization attempt', async () => {
    const initialize = mockInitialization();
    const onComplete = jest.fn();
    const message = 'Supabase authorization failed. Connect your organization again.';
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
      body: {status: 'complete', data: integration},
    });
    renderGlobalModal({organization});

    act(() => openPipelineModal({type: 'integration', provider: 'supabase', onComplete}));
    await userEvent.click(
      await screen.findByRole('button', {name: 'Authorize Supabase'})
    );
    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'expired-code',
        state: 'pipeline-state',
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(onComplete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', {name: 'Authorize Supabase'}));
    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'new-code',
        state: 'pipeline-state',
      },
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(integration));
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('allows retrying canceled authorization without submitting an empty code', async () => {
    const advance = jest.fn();
    render(
      <SupabaseOAuthLoginStep
        {...makeStepProps({stepData: {oauthUrl: OAUTH_URL}, advance})}
      />
    );
    await userEvent.click(screen.getByRole('button', {name: 'Authorize Supabase'}));
    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        error: 'access_denied',
        state: 'pipeline-state',
      },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Supabase authorization was canceled. Authorize your organization to try again.'
    );
    expect(advance).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', {name: 'Authorize Supabase'}));
    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'supabase-code',
        state: 'pipeline-state',
      },
    });

    expect(advance).toHaveBeenCalledWith({
      code: 'supabase-code',
      state: 'pipeline-state',
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables authorization until the URL is ready', () => {
    render(<SupabaseOAuthLoginStep {...makeStepProps({stepData: {}})} />);
    expect(screen.getByRole('button', {name: 'Authorize Supabase'})).toBeDisabled();
  });

  it('prevents opening another popup while the callback is being submitted', async () => {
    render(
      <SupabaseOAuthLoginStep
        {...makeStepProps({stepData: {oauthUrl: OAUTH_URL}, isAdvancing: true})}
      />
    );
    const button = screen.getByRole('button', {name: 'Authorize Supabase'});
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(window.open).not.toHaveBeenCalled();
  });
});
