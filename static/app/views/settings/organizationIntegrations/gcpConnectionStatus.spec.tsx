import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {OrganizationIntegration} from 'sentry/types/integrations';
import {GcpConnectionStatus} from 'sentry/views/settings/organizationIntegrations/gcpConnectionStatus';

describe('GcpConnectionStatus', () => {
  const organization = OrganizationFixture();
  const VERIFY_URL = `/organizations/${organization.slug}/monitoring-providers/gcp/verify-connection/`;

  const baseConfig = {
    sentry_sa_email: 'sentry-abc@sentry-connectors.iam.gserviceaccount.com',
    customer_sa_email: 'gcp-sentry@my-project.iam.gserviceaccount.com',
    projects: 'project-prod, project-staging',
  };

  function renderStatus({
    configData,
    isVerifying = false,
    onRetested = jest.fn(),
  }: {
    configData: OrganizationIntegration['configData'];
    isVerifying?: boolean;
    onRetested?: jest.Mock;
  }) {
    render(
      <GcpConnectionStatus
        configData={configData}
        organization={organization}
        isVerifying={isVerifying}
        onRetested={onRetested}
      />,
      {organization}
    );
    return onRetested;
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows a connected integration with no remediation', () => {
    renderStatus({
      configData: {
        ...baseConfig,
        connection_status: 'connected',
        project_statuses: [
          {
            gcp_project_id: 'project-prod',
            connection_status: 'connected',
            error_detail: null,
          },
        ],
        last_verified_at: '2026-08-30T00:00:00+00:00',
      },
    });

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/Last checked/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Re-test'})).toBeEnabled();
  });

  it('shows the failure message alongside the status', () => {
    renderStatus({
      configData: {
        ...baseConfig,
        connection_status: 'permission_denied',
        project_statuses: [
          {
            gcp_project_id: 'project-prod',
            connection_status: 'permission_denied',
            error_detail:
              'IAM roles not granted — verify your service account has viewer roles on this project',
          },
        ],
        last_verified_at: '2026-08-30T00:00:00+00:00',
      },
    });

    expect(screen.getByText('Permission denied')).toBeInTheDocument();
    expect(
      screen.getByText(
        'IAM roles not granted — verify your service account has viewer roles on this project'
      )
    ).toBeInTheDocument();
  });

  it('collapses the same failure reported by several projects', () => {
    renderStatus({
      configData: {
        ...baseConfig,
        connection_status: 'permission_denied',
        project_statuses: [
          {
            gcp_project_id: 'project-prod',
            connection_status: 'permission_denied',
            error_detail: 'IAM roles not granted',
          },
          {
            gcp_project_id: 'project-staging',
            connection_status: 'permission_denied',
            error_detail: 'IAM roles not granted',
          },
        ],
        last_verified_at: '2026-08-30T00:00:00+00:00',
      },
    });

    expect(screen.getAllByText('IAM roles not granted')).toHaveLength(1);
  });

  it('reports an integration whose settings changed but was never re-checked', () => {
    renderStatus({
      configData: {
        ...baseConfig,
        connection_status: 'unverified',
        project_statuses: [
          {
            gcp_project_id: 'project-prod',
            connection_status: 'unverified',
            error_detail: null,
          },
        ],
        last_verified_at: null,
      },
    });

    expect(screen.getByText('Not verified')).toBeInTheDocument();
    expect(screen.getByText('Never checked')).toBeInTheDocument();
  });

  it('re-tests the connection and refreshes the integration', async () => {
    const verifyRequest = MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      body: {connectionStatus: 'connected', projects: []},
    });
    const onRetested = renderStatus({
      configData: {
        ...baseConfig,
        connection_status: 'unverified',
        project_statuses: [],
        last_verified_at: null,
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Re-test'}));

    await waitFor(() =>
      expect(verifyRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            customerSaEmail: baseConfig.customer_sa_email,
            gcpProjectIds: ['project-prod', 'project-staging'],
          },
        })
      )
    );
    await waitFor(() => expect(onRetested).toHaveBeenCalled());
  });

  it('still refreshes when the re-test request fails', async () => {
    MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      statusCode: 502,
    });
    const onRetested = renderStatus({
      configData: {
        ...baseConfig,
        connection_status: 'unverified',
        project_statuses: [],
        last_verified_at: null,
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Re-test'}));

    await waitFor(() => expect(onRetested).toHaveBeenCalled());
  });

  it('reports a check started elsewhere on the page as running', () => {
    renderStatus({
      isVerifying: true,
      configData: {
        ...baseConfig,
        connection_status: 'unverified',
        project_statuses: [
          {
            gcp_project_id: 'project-prod',
            connection_status: 'permission_denied',
            error_detail: 'IAM roles not granted',
          },
        ],
        last_verified_at: null,
      },
    });

    expect(screen.getByText('Checking connection...')).toBeInTheDocument();
    expect(screen.queryByText('Not verified')).not.toBeInTheDocument();
    expect(screen.queryByText('IAM roles not granted')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Re-test'})).toBeDisabled();
  });

  it('hides the previous result while a re-test is running', async () => {
    MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      body: {connectionStatus: 'connected', projects: []},
      asyncDelay: 50,
    });
    renderStatus({
      configData: {
        ...baseConfig,
        connection_status: 'permission_denied',
        project_statuses: [
          {
            gcp_project_id: 'project-prod',
            connection_status: 'permission_denied',
            error_detail: 'IAM roles not granted',
          },
        ],
        last_verified_at: '2026-08-30T00:00:00+00:00',
      },
    });

    expect(screen.getByText('IAM roles not granted')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Re-test'}));

    expect(await screen.findByText('Checking connection...')).toBeInTheDocument();
    expect(screen.queryByText('IAM roles not granted')).not.toBeInTheDocument();
    expect(screen.queryByText(/Last checked/)).not.toBeInTheDocument();
  });

  it('cannot be re-tested when the config is incomplete', () => {
    renderStatus({
      configData: {
        sentry_sa_email: baseConfig.sentry_sa_email,
        connection_status: 'unverified',
        project_statuses: [],
        last_verified_at: null,
      },
    });

    expect(screen.getByRole('button', {name: 'Re-test'})).toBeDisabled();
  });
});
