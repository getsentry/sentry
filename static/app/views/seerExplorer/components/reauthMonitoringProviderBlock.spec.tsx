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
import {ReauthMonitoringProviderBlock} from 'sentry/views/seerExplorer/components/reauthMonitoringProviderBlock';
import type {ReauthMonitoringProviderData} from 'sentry/views/seerExplorer/types';

describe('ReauthMonitoringProviderBlock', () => {
  const organization = OrganizationFixture();

  const patData: ReauthMonitoringProviderData = {
    auth_method: 'pat',
    provider_key: 'datadog_pat',
    message: 'Your datadog_pat access expired — re-authenticate to continue.',
    identity_id: 2,
  };

  const oauthData: ReauthMonitoringProviderData = {
    auth_method: 'oauth',
    provider_key: 'datadog',
    message: 'Your datadog access expired — re-authenticate to continue.',
    identity_id: 3,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders the message and a Reconnect button for PAT (no Resume)', () => {
    render(<ReauthMonitoringProviderBlock data={patData} onComplete={jest.fn()} />, {
      organization,
    });

    expect(screen.getByText(patData.message)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Reconnect'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Resume'})).not.toBeInTheDocument();
  });

  it('PAT reconnect opens the modal, submits the token, and resumes', async () => {
    const onComplete = jest.fn();
    const connectMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/datadog_pat/`,
      method: 'POST',
      statusCode: 204,
      match: [
        MockApiClient.matchData({access_token: 'my-pat-token', site: 'datadoghq.com'}),
      ],
    });

    render(<ReauthMonitoringProviderBlock data={patData} onComplete={onComplete} />, {
      organization,
    });
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Reconnect'}));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Access Token'), 'my-pat-token');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Connect'}));

    await waitFor(() => expect(connectMock).toHaveBeenCalled());
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('renders Reconnect and Resume buttons for OAuth', () => {
    render(<ReauthMonitoringProviderBlock data={oauthData} onComplete={jest.fn()} />, {
      organization,
    });

    expect(screen.getByText(oauthData.message)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Reconnect'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Resume'})).toBeInTheDocument();
  });

  it('OAuth reconnect posts and redirects to the authorize URL', async () => {
    const connectMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/datadog/`,
      method: 'POST',
      body: {redirectUrl: 'https://mcp.datadoghq.com/authorize'},
      match: [MockApiClient.matchData({site: 'datadoghq.com'})],
    });

    render(<ReauthMonitoringProviderBlock data={oauthData} onComplete={jest.fn()} />, {
      organization,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Reconnect'}));

    await waitFor(() => expect(connectMock).toHaveBeenCalled());
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      'https://mcp.datadoghq.com/authorize'
    );
  });

  it('OAuth Resume resumes the run without reconnecting', async () => {
    const onComplete = jest.fn();

    render(<ReauthMonitoringProviderBlock data={oauthData} onComplete={onComplete} />, {
      organization,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Resume'}));

    expect(onComplete).toHaveBeenCalled();
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });
});
