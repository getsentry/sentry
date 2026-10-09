import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {CustomerIntegrationDebugDetails} from 'admin/components/customers/customerIntegrationDebugDetails';

describe('CustomerIntegrationDebugDetails', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/integrations/`,
      body: [],
    });
  });

  it('confirms and resets integrations', async () => {
    const resetMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/integrations/reset/`,
      method: 'POST',
    });

    render(<CustomerIntegrationDebugDetails orgId={organization.slug} />);

    await userEvent.click(screen.getByRole('button', {name: 'Reset Integrations'}));
    renderGlobalModal();

    expect(
      screen.getByText(
        /Supported integrations will be enabled and their grace periods cleared/
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(resetMock).toHaveBeenCalledTimes(1));
  });

  it('shows the integration metadata row when an integration is expanded', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/integrations/`,
      body: [
        {
          id: 1,
          status: 0,
          dateAdded: null,
          gracePeriodEnd: null,
          integration: {
            id: 2,
            externalId: 'external-1',
            metadata: {domain: 'example.com'},
            name: 'Example',
            provider: 'github',
            status: 0,
          },
        },
      ],
    });

    render(<CustomerIntegrationDebugDetails orgId={organization.slug} />);

    const table = await screen.findByRole('table', {name: 'Integration Debug Details'});
    await within(table).findByRole('cell', {name: 'github'});
    const rowsBefore = within(table).getAllByRole('row');

    await userEvent.click(within(table).getByRole('button', {name: 'Expand row'}));

    expect(rowsBefore).toHaveLength(2);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('Integration Metadata')).toBeInTheDocument();
    expect(within(table).getByText(/example\.com/)).toBeInTheDocument();
  });
});
