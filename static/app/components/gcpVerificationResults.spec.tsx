import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {GcpVerificationResults} from 'sentry/components/gcpVerificationResults';

describe('GcpVerificationResults', () => {
  it('shows one explanation and the affected services beside each project', async () => {
    render(
      <GcpVerificationResults
        result={{
          connectionStatus: 'permission_denied',
          projects: [
            ...['test-project-a', 'test-project-b'].map(gcpProjectId => ({
              gcpProjectId,
              connectionStatus: 'permission_denied',
              services: ['logging', 'monitoring', 'cloudtrace'].map(service => ({
                service,
                status: 'permission_denied',
                errorDetail: 'Check the project ID and service account access.',
              })),
            })),
            {gcpProjectId: 'production', connectionStatus: 'connected', services: []},
          ],
        }}
      />
    );

    expect(
      screen.getAllByText('Check the project ID and service account access.')
    ).toHaveLength(1);
    expect(
      screen.getByText('1 project connected · 2 projects need attention')
    ).toBeInTheDocument();
    const affected = screen.getByRole('list', {name: 'Affected projects'});
    expect(within(affected).getAllByRole('listitem')).toHaveLength(2);
    expect(
      within(affected).getAllByText('Cloud Logging, Cloud Monitoring, Cloud Trace')
    ).toHaveLength(2);
    expect(within(affected).getByText('test-project-a')).toBeInTheDocument();
    expect(within(affected).getByText('test-project-b')).toBeInTheDocument();
    expect(within(affected).queryByText('production')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Connected projects'}));
    expect(
      within(screen.getByRole('list', {name: 'Connected projects'})).getByText(
        'production'
      )
    ).toBeVisible();
  });

  it('separates mixed failures and shows project-level errors without services', () => {
    render(
      <GcpVerificationResults
        result={{
          connectionStatus: 'permission_denied',
          projects: [
            {
              gcpProjectId: 'project-a',
              connectionStatus: 'permission_denied',
              services: [
                {service: 'logging', status: 'connected'},
                {
                  service: 'monitoring',
                  status: 'api_disabled',
                  errorDetail: 'Enable the Monitoring API.',
                },
                {
                  service: 'cloudtrace',
                  status: 'permission_denied',
                  errorDetail: 'Check trace access.',
                },
              ],
            },
            {
              gcpProjectId: 'project-b',
              connectionStatus: 'error',
              services: [],
              errorDetail: 'Verification did not run.',
            },
          ],
        }}
      />
    );

    const api = screen.getByRole('region', {name: 'API disabled'});
    expect(within(api).getByText('Enable the Monitoring API.')).toBeInTheDocument();
    expect(within(api).getByText('Cloud Monitoring')).toBeInTheDocument();
    expect(within(api).queryByText('Cloud Trace')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', {name: 'Error'})).getByText('project-b')
    ).toBeInTheDocument();
    expect(screen.queryByText('Cloud Logging')).not.toBeInTheDocument();
  });

  it('distinguishes unverified projects from failures', () => {
    render(
      <GcpVerificationResults
        result={{
          connectionStatus: 'unverified',
          projects: [
            {
              gcpProjectId: 'project-a',
              connectionStatus: 'unverified',
              services: [],
            },
          ],
        }}
      />
    );
    expect(screen.getByText('1 project not verified')).toBeInTheDocument();
    expect(screen.getByRole('list', {name: 'Projects not verified'})).toHaveTextContent(
      'project-a'
    );
    expect(
      screen.queryByRole('list', {name: 'Affected projects'})
    ).not.toBeInTheDocument();
  });
});
