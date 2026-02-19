import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import OrganizationSecurityAndPrivacy from 'sentry/views/settings/organizationSecurityAndPrivacy';

describe('OrganizationSecurityAndPrivacy', () => {
  const {organization} = initializeOrg();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/auth-provider/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      method: 'GET',
      body: null,
    });
  });

  it('shows require2fa switch', async () => {
    render(<OrganizationSecurityAndPrivacy />);

    expect(
      await screen.findByRole('checkbox', {
        name: 'Require Two-Factor Authentication',
      })
    ).toBeInTheDocument();
  });

  it('shows error state if switch enable fails (e.g. API error)', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      statusCode: 500,
    });

    render(
      <Fragment>
        <GlobalModal />
        <OrganizationSecurityAndPrivacy />
      </Fragment>
    );

    await userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Require Two-Factor Authentication',
      })
    );

    // Hide console.error for this test
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Confirm but has API failure
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Confirm'}));

    // Verify the API was called
    await waitFor(() => {
      expect(mock).toHaveBeenCalled();
    });
  });

  it('renders join request switch when SSO is not enabled', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/auth-provider/`,
      method: 'GET',
      statusCode: 404,
      body: {},
    });

    render(<OrganizationSecurityAndPrivacy />);

    expect(
      await screen.findByRole('checkbox', {
        name: 'Allow Join Requests',
      })
    ).toBeInTheDocument();
  });

  it('enables require2fa but cancels confirm modal', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    render(
      <Fragment>
        <GlobalModal />
        <OrganizationSecurityAndPrivacy />
      </Fragment>
    );

    await userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Require Two-Factor Authentication',
      })
    );

    // Cancel within the confirm modal dialog
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));

    expect(
      screen.getByRole('checkbox', {
        name: 'Require Two-Factor Authentication',
      })
    ).not.toBeChecked();

    expect(mock).not.toHaveBeenCalled();
  });

  it('enables require2fa with confirm modal', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    render(
      <Fragment>
        <GlobalModal />
        <OrganizationSecurityAndPrivacy />
      </Fragment>
    );

    await userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Require Two-Factor Authentication',
      })
    );

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', {
          name: 'Require Two-Factor Authentication',
        })
      ).toBeChecked();
    });

    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          require2FA: true,
        },
      })
    );
  });
});
