import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import type {OrganizationIntegration} from 'sentry/types/integrations';
import {GcpConnectionStatus} from 'sentry/views/settings/organizationIntegrations/gcpConnectionStatus';

describe('GcpConnectionStatus', () => {
  const organization = OrganizationFixture();
  const VERIFY_URL = `/organizations/${organization.slug}/monitoring-providers/gcp/verify-connection/`;

  const baseConfig = {
    sentry_sa_email: 'sentry-abc@sentry-connectors.iam.gserviceaccount.com',
    customer_sa_email: 'gcp-sentry@my-project.iam.gserviceaccount.com',
    projects: ['project-prod', 'project-staging'],
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
            services: [],
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
            services: [],
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
            services: [],
            gcp_project_id: 'project-prod',
            connection_status: 'permission_denied',
            error_detail: 'IAM roles not granted',
          },
          {
            services: [],
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

  it('groups saved service failures under the affected project IDs', () => {
    renderStatus({
      configData: {
        ...baseConfig,
        connection_status: 'permission_denied',
        project_statuses: [
          ...['test-project-a', 'test-project-b'].map(gcp_project_id => ({
            gcp_project_id,
            connection_status: 'permission_denied',
            error_detail: null,
            services: ['logging', 'monitoring', 'cloudtrace'].map(service => ({
              service,
              status: 'permission_denied',
              error_detail: 'Check the project ID and service account access.',
            })),
          })),
          {
            gcp_project_id: 'production',
            connection_status: 'connected',
            error_detail: null,
            services: [],
          },
        ],
      },
    });

    expect(
      screen.getAllByText('Check the project ID and service account access.')
    ).toHaveLength(1);
    const affected = screen.getByRole('list', {name: 'Affected projects'});
    const rows = within(affected).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('test-project-a');
    expect(rows[1]).toHaveTextContent('test-project-b');
    for (const row of rows) {
      expect(row).toHaveTextContent('Cloud Logging, Cloud Monitoring, Cloud Trace');
    }
    expect(within(affected).queryByText('production')).not.toBeInTheDocument();
  });

  it('reports an integration whose settings changed but was never re-checked', () => {
    renderStatus({
      configData: {
        ...baseConfig,
        connection_status: 'unverified',
        project_statuses: [
          {
            services: [],
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

    expect(
      await screen.findByText("The connection check couldn't be completed. Try again.")
    ).toBeInTheDocument();
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
            services: [],
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

  it('labels previous results after a failed request and clears the warning on retry', async () => {
    MockApiClient.addMockResponse({url: VERIFY_URL, method: 'POST', statusCode: 502});
    renderStatus({
      configData: {
        ...baseConfig,
        connection_status: 'connected',
        project_statuses: [],
        last_verified_at: '2026-08-30T00:00:00+00:00',
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Re-test'}));
    expect(await screen.findByText('Previous verification result')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "The connection check couldn't be completed. Try again."
    );

    const verification = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      body: {connectionStatus: 'connected', projects: []},
      asyncDelay: verification.promise,
    });
    await userEvent.click(screen.getByRole('button', {name: 'Re-test'}));
    expect(screen.getByText('Checking connection...')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Previous verification result')).not.toBeInTheDocument();
    verification.resolve();
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Re-test'})).toBeEnabled()
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides the previous result while a re-test is running', async () => {
    const verification = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: VERIFY_URL,
      method: 'POST',
      body: {connectionStatus: 'connected', projects: []},
      asyncDelay: verification.promise,
    });
    renderStatus({
      configData: {
        ...baseConfig,
        connection_status: 'permission_denied',
        project_statuses: [
          {
            services: [],
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
    verification.resolve();
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Re-test'})).toBeEnabled()
    );
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
