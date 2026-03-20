import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from 'sentry/components/globalModal';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import OrganizationSecurityAndPrivacy from 'sentry/views/settings/organizationSecurityAndPrivacy';

describe('OrganizationSecurityAndPrivacy', () => {
  const {organization} = initializeOrg();

  beforeEach(() => {
    OrganizationsStore.load([organization]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/auth-provider/`,
      method: 'GET',
      statusCode: 404,
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
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    ).toBeInTheDocument();
  });

  it('returns to "off" if switch enable fails (e.g. API error)', async () => {
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

    await userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    );

    // Hide console.error for this test
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Confirm but has API failure
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    // AutoSaveForm calls onError and reverts the switch.
    // The checkbox should become enabled again after the mutation fails.
    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', {
          name: 'Enable to require and enforce two-factor authentication for all members',
        })
      ).toBeEnabled();
    });
  });

  it('renders join request switch', async () => {
    render(<OrganizationSecurityAndPrivacy />);

    expect(
      await screen.findByRole('checkbox', {
        name: 'Enable to allow users to request to join your organization',
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
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    );

    // Cancel via the confirm modal
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    ).not.toBeChecked();

    expect(mock).not.toHaveBeenCalled();
  });

  it('resets form to pristine after successful scrubbing config save', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {
        ...organization,
        sensitiveFields: ['email'],
        safeFields: [],
      },
    });

    render(<OrganizationSecurityAndPrivacy />);

    const sensitiveFieldsInput = await screen.findByRole('textbox', {
      name: 'Global Sensitive Fields',
    });
    await userEvent.type(sensitiveFieldsInput, 'email');

    // The changes alert should be visible after typing
    expect(
      screen.getByText(
        'Changes to your scrubbing configuration will apply to all new events.'
      )
    ).toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(mock).toHaveBeenCalled();
    });

    // After successful save, form.reset() syncs defaults so the form is pristine again
    // The changes alert should become hidden
    await waitFor(() => {
      expect(
        screen.getByText(
          'Changes to your scrubbing configuration will apply to all new events.'
        )
      ).not.toBeVisible();
    });
  });

  it('enables require2fa with confirm modal', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, require2FA: true},
    });

    render(
      <Fragment>
        <GlobalModal />
        <OrganizationSecurityAndPrivacy />
      </Fragment>
    );

    await userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    );

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
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
});
