import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AwsConnectionStatus} from './awsConnectionStatus';

describe('AwsConnectionStatus', () => {
  it('re-tests stored credentials and refreshes configuration', async () => {
    const organization = OrganizationFixture();
    const integration = OrganizationIntegrationsFixture({
      configData: {
        verification: {
          external_id_required: true,
          connection_status: 'connected',
          regions: [{region: 'us-east-1', connection_status: 'connected', services: []}],
        },
      },
    });
    const onRetested = jest.fn().mockResolvedValue(undefined);
    const url = `/organizations/${organization.slug}/integrations/${integration.id}/`;
    const retest = MockApiClient.addMockResponse({url, method: 'POST', body: {}});
    render(<AwsConnectionStatus integration={integration} onRetested={onRetested} />, {
      organization,
    });
    expect(screen.getByText('Connected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Re-test'}));
    await waitFor(() => expect(onRetested).toHaveBeenCalledTimes(1));
    expect(retest).toHaveBeenCalledWith(url, expect.objectContaining({data: {}}));
  });

  it('handles unavailable verification and malformed saved results', async () => {
    const organization = OrganizationFixture();
    const integration = OrganizationIntegrationsFixture({
      configData: {verification: {connection_status: 'connected'}},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integration.id}/`,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Unavailable'},
    });
    render(<AwsConnectionStatus integration={integration} onRetested={jest.fn()} />, {
      organization,
    });
    expect(
      screen.getByText('Re-test the connection to verify AWS access.')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Re-test'}));
    expect(
      await screen.findByText('The connection check could not be completed. Try again.')
    ).toBeInTheDocument();
  });
});
