import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import {MonitoringProvidersSection} from 'getsentry/views/seerAutomation/components/monitoringProviders';

describe('MonitoringProvidersSection', () => {
  const organization = OrganizationFixture({
    features: ['seer-infra-telemetry'],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders providers list', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      body: {
        providers: [
          {provider: 'datadog', name: 'Datadog', connected: false},
          {provider: 'gcp', name: 'Google Cloud Platform', connected: false},
        ],
      },
    });

    render(<MonitoringProvidersSection />, {organization});

    expect(await screen.findByText('Datadog')).toBeInTheDocument();
    expect(screen.getByText('Google Cloud Platform')).toBeInTheDocument();
    expect(screen.getAllByText('Not connected')).toHaveLength(2);
    expect(screen.getAllByRole('button', {name: 'Connect'})).toHaveLength(2);
  });

  it('shows connected status', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      body: {
        providers: [
          {provider: 'datadog', name: 'Datadog', connected: true},
          {provider: 'gcp', name: 'Google Cloud Platform', connected: false},
        ],
      },
    });

    render(<MonitoringProvidersSection />, {organization});

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Disconnect'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Connect'})).toBeInTheDocument();
  });

  it('connect button redirects to OAuth URL', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      body: {
        providers: [{provider: 'gcp', name: 'Google Cloud Platform', connected: false}],
      },
    });

    const connectMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/gcp/`,
      method: 'POST',
      body: {redirectUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test'},
    });

    render(<MonitoringProvidersSection />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Connect'}));

    await waitFor(() => expect(connectMock).toHaveBeenCalled());
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=test'
    );
  });

  it('connect button sends site for datadog', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      body: {
        providers: [{provider: 'datadog', name: 'Datadog', connected: false}],
      },
    });

    const connectMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/datadog/`,
      method: 'POST',
      body: {redirectUrl: 'https://mcp.datadoghq.com/authorize'},
      match: [MockApiClient.matchData({site: 'datadoghq.com'})],
    });

    render(<MonitoringProvidersSection />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Connect'}));

    await waitFor(() => expect(connectMock).toHaveBeenCalled());
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      'https://mcp.datadoghq.com/authorize'
    );
  });

  it('disconnect button deletes identity after confirmation', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      body: {
        providers: [{provider: 'gcp', name: 'Google Cloud Platform', connected: true}],
      },
    });

    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/gcp/`,
      method: 'DELETE',
      statusCode: 204,
    });

    render(<MonitoringProvidersSection />, {organization});
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Disconnect'}));

    // Confirm the modal
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(deleteMock).toHaveBeenCalled());
  });

  it('shows error state when fetch fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      statusCode: 500,
    });

    render(<MonitoringProvidersSection />, {organization});

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });
});

describe('Datadog PAT flow', () => {
  const organization = OrganizationFixture({
    features: ['seer-infra-telemetry'],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders PAT provider in list', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      body: {
        providers: [
          {
            provider: 'datadog_pat',
            name: 'Datadog (Personal Access Token)',
            connected: false,
          },
        ],
      },
    });

    render(<MonitoringProvidersSection />, {organization});

    expect(
      await screen.findByText('Datadog (Personal Access Token)')
    ).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
  });

  it('connect on PAT provider opens modal instead of redirecting', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      body: {
        providers: [
          {
            provider: 'datadog_pat',
            name: 'Datadog (Personal Access Token)',
            connected: false,
          },
        ],
      },
    });

    render(<MonitoringProvidersSection />, {organization});
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Connect'}));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Connect Datadog (Personal Access Token)')
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Access Token')).toBeInTheDocument();
    expect(within(dialog).getByText('Datadog Site')).toBeInTheDocument();
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('PAT modal submits token and shows success', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      body: {
        providers: [
          {
            provider: 'datadog_pat',
            name: 'Datadog (Personal Access Token)',
            connected: false,
          },
        ],
      },
    });

    const connectMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/datadog_pat/`,
      method: 'POST',
      statusCode: 204,
      match: [
        MockApiClient.matchData({access_token: 'my-pat-token', site: 'datadoghq.com'}),
      ],
    });

    render(<MonitoringProvidersSection />, {organization});
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Connect'}));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Access Token'), 'my-pat-token');

    // Override GET mock before submit so refetch returns updated state
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      body: {
        providers: [
          {
            provider: 'datadog_pat',
            name: 'Datadog (Personal Access Token)',
            connected: true,
          },
        ],
      },
    });

    await userEvent.click(within(dialog).getByRole('button', {name: 'Connect'}));

    await waitFor(() => expect(connectMock).toHaveBeenCalled());
    expect(await screen.findByText('Connected')).toBeInTheDocument();
  });

  it('PAT modal shows validation error', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      body: {
        providers: [
          {
            provider: 'datadog_pat',
            name: 'Datadog (Personal Access Token)',
            connected: false,
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/datadog_pat/`,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Failed to verify token with provider.'},
    });

    render(<MonitoringProvidersSection />, {organization});
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Connect'}));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Access Token'), 'bad-token');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Connect'}));

    expect(
      await screen.findByText('Failed to verify token with provider.')
    ).toBeInTheDocument();
  });

  it('PAT modal shows conflict error', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      body: {
        providers: [
          {
            provider: 'datadog_pat',
            name: 'Datadog (Personal Access Token)',
            connected: false,
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/datadog_pat/`,
      method: 'POST',
      statusCode: 409,
      body: {detail: 'This account is already connected.'},
    });

    render(<MonitoringProvidersSection />, {organization});
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Connect'}));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Access Token'), 'my-token');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Connect'}));

    expect(
      await screen.findByText('This account is already connected.')
    ).toBeInTheDocument();
  });

  it('disconnect works for PAT provider', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      body: {
        providers: [
          {
            provider: 'datadog_pat',
            name: 'Datadog (Personal Access Token)',
            connected: true,
          },
        ],
      },
    });

    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/datadog_pat/`,
      method: 'DELETE',
      statusCode: 204,
    });

    render(<MonitoringProvidersSection />, {organization});
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Disconnect'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(deleteMock).toHaveBeenCalled());
  });

  it('cancel closes modal without submitting', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/`,
      body: {
        providers: [
          {
            provider: 'datadog_pat',
            name: 'Datadog (Personal Access Token)',
            connected: false,
          },
        ],
      },
    });

    const connectMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/datadog_pat/`,
      method: 'POST',
      statusCode: 204,
    });

    render(<MonitoringProvidersSection />, {organization});
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Connect'}));
    expect(
      await screen.findByText('Connect Datadog (Personal Access Token)')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    await waitFor(() => {
      expect(
        screen.queryByText('Connect Datadog (Personal Access Token)')
      ).not.toBeInTheDocument();
    });
    expect(connectMock).not.toHaveBeenCalled();
  });
});
