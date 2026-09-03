import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
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
      screen.getByText(/Supported integrations will be enabled and their grace periods cleared/)
    ).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(resetMock).toHaveBeenCalledTimes(1));
  });
});
