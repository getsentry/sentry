import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import OrganizationSecurityAndPrivacy from 'sentry/views/settings/organizationSecurityAndPrivacy';

describe('OrganizationSecurityAndPrivacy', function () {
  const {organization} = initializeOrg();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/auth-provider/`,
      method: 'GET',
      body: {},
    });
  });

  it('shows require2fa switch', async function () {
    render(<OrganizationSecurityAndPrivacy />);

    expect(
      await screen.findByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    ).toBeInTheDocument();
  });

  it('returns to "off" if switch enable fails (e.g. API error)', async function () {
    MockApiClient.addMockResponse({
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

    userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    );

    // Hide console.error for this test
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Confirm but has API failure
    userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(
      await screen.findByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    ).not.toBeChecked();
  });

  it('renders join request switch', async function () {
    render(<OrganizationSecurityAndPrivacy />);

    expect(
      await screen.findByRole('checkbox', {
        name: 'Enable to allow users to request to join your organization',
      })
    ).toBeInTheDocument();
  });

  it('enables require2fa but cancels confirm modal', async function () {
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

    userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    );

    // Cancel
    userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    ).not.toBeChecked();

    expect(mock).not.toHaveBeenCalled();
  });

  it('enables require2fa with confirm modal', async function () {
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

    userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    );

    userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    ).toBeChecked();

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
