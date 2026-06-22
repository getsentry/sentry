import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
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
