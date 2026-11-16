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

import {grafanaIntegrationPipeline} from '.';

const organization = OrganizationFixture();
const API_URL = `/organizations/${organization.slug}/pipeline/integration_pipeline/`;
const GRAFANA_URL = 'https://example-stack.grafana.net';
const GrafanaCredentialsStep = grafanaIntegrationPipeline.steps[0].component;
const makeStepProps = createMakeStepProps({totalSteps: 1});

function mockInitialization() {
  return MockApiClient.addMockResponse({
    url: API_URL,
    method: 'POST',
    match: [MockApiClient.matchData({action: 'initialize', provider: 'grafana'})],
    body: {
      step: 'grafana_credentials',
      stepIndex: 0,
      totalSteps: 1,
      provider: 'grafana',
      data: {},
    },
  });
}

describe('Grafana integration pipeline', () => {
  it('installs through the registered pipeline with trimmed credentials', async () => {
    mockInitialization();
    const integration = OrganizationIntegrationsFixture();
    const onComplete = jest.fn();
    const install = MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({url: GRAFANA_URL, token: 'glsa_token'})],
      body: {status: 'complete', data: integration},
    });
    renderGlobalModal({organization});

    act(() => openPipelineModal({type: 'integration', provider: 'grafana', onComplete}));

    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Grafana URL'}),
      `  ${GRAFANA_URL}  `
    );
    const token = screen.getByLabelText('Service account token');
    expect(token).toHaveAttribute('type', 'password');
    await userEvent.type(token, '  glsa_token  ');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(integration));
    expect(install).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({data: {url: GRAFANA_URL, token: 'glsa_token'}})
    );
  });

  it('shows connection errors and retries without restarting the pipeline', async () => {
    const initialize = mockInitialization();
    const onComplete = jest.fn();
    const message =
      'Grafana rejected the token. Check that it is an active service account token.';
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({url: GRAFANA_URL, token: 'glsa_bad'})],
      statusCode: 400,
      body: {status: 'error', data: {detail: message}},
    });
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      match: [MockApiClient.matchData({url: GRAFANA_URL, token: 'glsa_corrected'})],
      body: {status: 'complete', data: OrganizationIntegrationsFixture()},
    });
    renderGlobalModal({organization});

    act(() => openPipelineModal({type: 'integration', provider: 'grafana', onComplete}));

    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Grafana URL'}),
      GRAFANA_URL
    );
    await userEvent.type(screen.getByLabelText('Service account token'), 'glsa_bad');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('textbox', {name: 'Grafana URL'})).toHaveValue(GRAFANA_URL);
    await userEvent.clear(screen.getByLabelText('Service account token'));
    await userEvent.type(
      screen.getByLabelText('Service account token'),
      'glsa_corrected'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it.each([
    {url: '', token: 'glsa_token'},
    {url: GRAFANA_URL, token: ''},
  ])('requires both credentials: %j', async values => {
    const advance = jest.fn();
    render(<GrafanaCredentialsStep {...makeStepProps({stepData: {}, advance})} />);

    await userEvent.click(screen.getByRole('textbox', {name: 'Grafana URL'}));
    await userEvent.paste(values.url);
    await userEvent.click(screen.getByLabelText('Service account token'));
    await userEvent.paste(values.token);
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(advance).not.toHaveBeenCalled();
  });
});
