import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';

import ConsoleSDKInvitesSettings from './index';

describe('ConsoleSDKInvitesSettings', () => {
  const ENDPOINT = '/organizations/org-slug/console-sdk-invites/';

  const defaultOrganization = OrganizationFixture({
    enabledConsolePlatforms: ['playstation', 'xbox'],
    consoleSdkInviteQuota: 10,
    orgRole: 'admin',
  });

  beforeEach(() => {
    OrganizationsStore.addOrReplace(defaultOrganization);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows error state with retry', async () => {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      statusCode: 500,
    });

    render(<ConsoleSDKInvitesSettings />, {organization: defaultOrganization});

    expect(await screen.findByTestId('loading-error')).toBeInTheDocument();
    expect(mock).toHaveBeenCalledTimes(1);

    // Mock successful response for retry
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: [],
    });

    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    // Wait for the empty state to appear after successful retry
    expect(await screen.findByText('No invites found')).toBeInTheDocument();
  });

  it('shows invites with platform tags', async () => {
    const invites = [
      {
        user_id: '1',
        email: 'user1@example.com',
        platforms: ['playstation', 'xbox'],
      },
      {
        user_id: '2',
        email: 'user2@example.com',
        platforms: ['nintendo-switch'],
      },
    ];

    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: invites,
    });

    render(<ConsoleSDKInvitesSettings />, {organization: defaultOrganization});

    expect(await screen.findByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('user2@example.com')).toBeInTheDocument();
    expect(screen.getByText('PlayStation')).toBeInTheDocument();
    expect(screen.getByText('Xbox')).toBeInTheDocument();
    expect(screen.getByText('Nintendo Switch')).toBeInTheDocument();
  });

  it('shows no access state when organization has no console platforms enabled', async () => {
    const orgWithoutConsoleAccess = OrganizationFixture({
      enabledConsolePlatforms: [],
      consoleSdkInviteQuota: 10,
    });

    OrganizationsStore.addOrReplace(orgWithoutConsoleAccess);

    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: [],
    });

    render(<ConsoleSDKInvitesSettings />, {organization: orgWithoutConsoleAccess});

    expect(
      await screen.findByText(
        /Your organization does not have any console platforms enabled/
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'PlayStation'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Nintendo Switch'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Xbox'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Request SDK Access'})).toBeDisabled();
  });

  it('shows no quota remaining alert when invite quota is exhausted', async () => {
    const orgWithExhaustedQuota = OrganizationFixture({
      enabledConsolePlatforms: ['playstation'],
      consoleSdkInviteQuota: 2,
    });

    OrganizationsStore.addOrReplace(orgWithExhaustedQuota);

    const invites = [
      {user_id: '1', email: 'user1@example.com', platforms: ['playstation']},
      {user_id: '2', email: 'user2@example.com', platforms: ['playstation']},
    ];

    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: invites,
    });

    render(<ConsoleSDKInvitesSettings />, {organization: orgWithExhaustedQuota});

    expect(
      await screen.findByText(/has used all GitHub invites available/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Contact support/)).toBeInTheDocument();
  });

  describe('revoking platform invites', () => {
    it('allows revoking a platform invite', async () => {
      jest.spyOn(indicators, 'addSuccessMessage');

      const invites = [
        {
          user_id: '1',
          email: 'user1@example.com',
          platforms: ['playstation', 'xbox'],
        },
      ];

      MockApiClient.addMockResponse({
        url: ENDPOINT,
        method: 'GET',
        body: invites,
      });

      const deleteMock = MockApiClient.addMockResponse({
        url: ENDPOINT,
        method: 'DELETE',
        body: {success: true},
      });

      render(<ConsoleSDKInvitesSettings />, {organization: defaultOrganization});

      expect(await screen.findByText('PlayStation')).toBeInTheDocument();
      expect(screen.getByText('Xbox')).toBeInTheDocument();

      // Get all dismiss buttons and click the first one (PlayStation)
      const dismissButtons = screen.getAllByRole('button', {name: 'Dismiss'});
      await userEvent.click(dismissButtons[0]!);

      // Update mock for refetch after revoke
      MockApiClient.addMockResponse({
        url: ENDPOINT,
        method: 'GET',
        body: [{user_id: '1', email: 'user1@example.com', platforms: ['xbox']}],
      });

      await waitFor(() => {
        expect(deleteMock).toHaveBeenCalledWith(
          ENDPOINT,
          expect.objectContaining({
            method: 'DELETE',
            data: {user_id: '1', platforms: ['playstation']},
          })
        );
      });

      expect(indicators.addSuccessMessage).toHaveBeenCalled();
    });

    it('shows error message when revoke fails', async () => {
      jest.spyOn(indicators, 'addErrorMessage');

      const invites = [
        {
          user_id: '1',
          email: 'user1@example.com',
          platforms: ['playstation'],
        },
      ];

      MockApiClient.addMockResponse({
        url: ENDPOINT,
        method: 'GET',
        body: invites,
      });

      MockApiClient.addMockResponse({
        url: ENDPOINT,
        method: 'DELETE',
        statusCode: 500,
      });

      render(<ConsoleSDKInvitesSettings />, {organization: defaultOrganization});

      const dismissButton = await screen.findByRole('button', {name: 'Dismiss'});
      await userEvent.click(dismissButton);

      await waitFor(() => {
        expect(indicators.addErrorMessage).toHaveBeenCalled();
      });
    });

    it('allows members to revoke their own invites', async () => {
      const memberOrg = OrganizationFixture({
        enabledConsolePlatforms: ['playstation'],
        consoleSdkInviteQuota: 10,
        orgRole: 'member',
      });

      OrganizationsStore.addOrReplace(memberOrg);
      ConfigStore.set('user', UserFixture({email: 'member@example.com'}));

      const invites = [
        {
          user_id: '1',
          email: 'member@example.com',
          platforms: ['playstation'],
        },
      ];

      MockApiClient.addMockResponse({
        url: ENDPOINT,
        method: 'GET',
        body: invites,
      });

      const deleteMock = MockApiClient.addMockResponse({
        url: ENDPOINT,
        method: 'DELETE',
        body: {success: true},
      });

      render(<ConsoleSDKInvitesSettings />, {organization: memberOrg});

      // Member should see dismiss button for their own invite
      const dismissButton = await screen.findByRole('button', {name: 'Dismiss'});
      expect(dismissButton).toBeInTheDocument();

      await userEvent.click(dismissButton);

      await waitFor(() => {
        expect(deleteMock).toHaveBeenCalled();
      });
    });

    it.each(['member', 'billing'] as const)(
      'prevents %s users from revoking other users invites',
      async role => {
        const org = OrganizationFixture({
          enabledConsolePlatforms: ['playstation'],
          consoleSdkInviteQuota: 10,
          orgRole: role,
        });

        OrganizationsStore.addOrReplace(org);
        ConfigStore.set('user', UserFixture({email: `${role}@example.com`}));

        const invites = [
          {
            user_id: '2',
            email: 'other-user@example.com',
            platforms: ['playstation'],
          },
        ];

        MockApiClient.addMockResponse({
          url: ENDPOINT,
          method: 'GET',
          body: invites,
        });

        render(<ConsoleSDKInvitesSettings />, {organization: org});

        // Platform tag should be visible but no dismiss button
        expect(await screen.findByText('PlayStation')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Dismiss'})).not.toBeInTheDocument();
      }
    );

    it.each(['admin', 'manager', 'owner'] as const)(
      'allows %s users to revoke any users invites',
      async role => {
        const org = OrganizationFixture({
          enabledConsolePlatforms: ['playstation'],
          consoleSdkInviteQuota: 10,
          orgRole: role,
        });

        OrganizationsStore.addOrReplace(org);
        ConfigStore.set('user', UserFixture({email: `${role}@example.com`}));

        const invites = [
          {
            user_id: '2',
            email: 'other-user@example.com',
            platforms: ['playstation'],
          },
        ];

        MockApiClient.addMockResponse({
          url: ENDPOINT,
          method: 'GET',
          body: invites,
        });

        const deleteMock = MockApiClient.addMockResponse({
          url: ENDPOINT,
          method: 'DELETE',
          body: {success: true},
        });

        render(<ConsoleSDKInvitesSettings />, {organization: org});

        // Should see dismiss button for any invite
        const dismissButton = await screen.findByRole('button', {name: 'Dismiss'});
        expect(dismissButton).toBeInTheDocument();

        await userEvent.click(dismissButton);

        await waitFor(() => {
          expect(deleteMock).toHaveBeenCalled();
        });
      }
    );
  });
});
