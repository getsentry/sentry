import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {updateMember} from 'sentry/actionCreators/members';
import TeamStore from 'sentry/stores/teamStore';
import OrganizationMemberDetail from 'sentry/views/settings/organizationMembers/organizationMemberDetail';

jest.mock('sentry/actionCreators/members', () => ({
  updateMember: jest.fn().mockReturnValue(new Promise(() => {})),
}));

describe('OrganizationMemberDetail', function () {
  let organization;
  let routerContext;
  const team = TestStubs.Team();
  const teams = [
    team,
    TestStubs.Team({
      id: '2',
      slug: 'new-team',
      name: 'New Team',
      isMember: false,
    }),
  ];
  const member = TestStubs.Member({
    roles: TestStubs.OrgRoleList(),
    dateCreated: new Date(),
    teams: [team.slug],
  });
  const pendingMember = TestStubs.Member({
    id: 2,
    roles: TestStubs.OrgRoleList(),
    dateCreated: new Date(),
    teams: [team.slug],
    invite_link: 'http://example.com/i/abc123',
    pending: true,
  });
  const expiredMember = TestStubs.Member({
    id: 3,
    roles: TestStubs.OrgRoleList(),
    dateCreated: new Date(),
    teams: [team.slug],
    invite_link: 'http://example.com/i/abc123',
    pending: true,
    expired: true,
  });

  describe('Can Edit', function () {
    beforeEach(function () {
      organization = TestStubs.Organization({teams});
      routerContext = TestStubs.routerContext([{organization}]);
      TeamStore.init();
      TeamStore.loadInitialData(teams);
      jest.resetAllMocks();
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${member.id}/`,
        body: member,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${pendingMember.id}/`,
        body: pendingMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${expiredMember.id}/`,
        body: expiredMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    it('changes role to owner', function () {
      render(<OrganizationMemberDetail params={{memberId: member.id}} />, {
        context: routerContext,
      });

      // Should have 4 roles
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(4);

      // Click last radio
      userEvent.click(radios.at(-1));
      expect(radios.at(-1)).toBeChecked();

      // Save Member
      userEvent.click(screen.getByRole('button', {name: 'Save Member'}));

      expect(updateMember).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'owner',
          }),
        })
      );
    });

    it('leaves a team', function () {
      render(<OrganizationMemberDetail params={{memberId: member.id}} />, {
        context: routerContext,
      });

      // Remove our one team
      userEvent.click(screen.getByRole('button', {name: 'Remove'}));

      // Save Member
      userEvent.click(screen.getByRole('button', {name: 'Save Member'}));

      expect(updateMember).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            teams: [],
          }),
        })
      );
    });

    it('joins a team', function () {
      render(<OrganizationMemberDetail params={{memberId: member.id}} />, {
        context: routerContext,
      });

      // Should have one team enabled
      expect(screen.getByTestId('team-row')).toBeInTheDocument();

      // Select new team to join
      // Open the dropdown
      userEvent.click(screen.getByText('Add Team'));
      // Click the first item
      userEvent.click(screen.getByText('#new-team'));

      // Save Member
      userEvent.click(screen.getByRole('button', {name: 'Save Member'}));

      expect(updateMember).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            teams: ['team-slug', 'new-team'],
          }),
        })
      );
    });
  });

  describe('Cannot Edit', function () {
    beforeEach(function () {
      organization = TestStubs.Organization({teams, access: ['org:read']});
      routerContext = TestStubs.routerContext([{organization}]);
      TeamStore.init();
      TeamStore.loadInitialData(teams);
      jest.resetAllMocks();
      MockApiClient.clearMockResponses();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${member.id}/`,
        body: member,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${pendingMember.id}/`,
        body: pendingMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${expiredMember.id}/`,
        body: expiredMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    it('can not change roles, teams, or save', function () {
      render(<OrganizationMemberDetail params={{memberId: member.id}} />, {
        context: routerContext,
      });

      // Should have 4 roles
      const radios = screen.getAllByRole('radio');
      expect(radios.at(0)).toHaveAttribute('readonly');

      // Save Member
      expect(screen.getByRole('button', {name: 'Save Member'})).toBeDisabled();
    });
  });

  describe('Display status', function () {
    beforeEach(function () {
      organization = TestStubs.Organization({teams, access: ['org:read']});
      routerContext = TestStubs.routerContext([{organization}]);
      TeamStore.init();
      TeamStore.loadInitialData(teams);
      jest.resetAllMocks();
      MockApiClient.clearMockResponses();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${member.id}/`,
        body: member,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${pendingMember.id}/`,
        body: pendingMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${expiredMember.id}/`,
        body: expiredMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    it('display pending status', function () {
      render(<OrganizationMemberDetail params={{memberId: pendingMember.id}} />, {
        context: routerContext,
      });

      expect(screen.getByTestId('member-status')).toHaveTextContent('Invitation Pending');
    });

    it('display expired status', function () {
      render(<OrganizationMemberDetail params={{memberId: expiredMember.id}} />, {
        context: routerContext,
      });

      expect(screen.getByTestId('member-status')).toHaveTextContent('Invitation Expired');
    });
  });

  describe('Show resend button', function () {
    beforeEach(function () {
      organization = TestStubs.Organization({teams, access: ['org:read']});
      routerContext = TestStubs.routerContext([{organization}]);
      TeamStore.init();
      TeamStore.loadInitialData(teams);
      jest.resetAllMocks();
      MockApiClient.clearMockResponses();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${member.id}/`,
        body: member,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${pendingMember.id}/`,
        body: pendingMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${expiredMember.id}/`,
        body: expiredMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    it('shows for pending', function () {
      render(<OrganizationMemberDetail params={{memberId: pendingMember.id}} />, {
        context: routerContext,
      });

      expect(screen.getByRole('button', {name: 'Resend Invite'})).toBeInTheDocument();
    });

    it('does not show for expired', function () {
      render(<OrganizationMemberDetail params={{memberId: expiredMember.id}} />, {
        context: routerContext,
      });

      expect(
        screen.queryByRole('button', {name: 'Resend Invite'})
      ).not.toBeInTheDocument();
    });
  });

  describe('Reset member 2FA', function () {
    const fields = {
      roles: TestStubs.OrgRoleList(),
      dateCreated: new Date(),
      teams: [team.slug],
    };

    const noAccess = TestStubs.Member({
      ...fields,
      id: '4',
      user: TestStubs.User({has2fa: false}),
    });

    const no2fa = TestStubs.Member({
      ...fields,
      id: '5',
      user: TestStubs.User({has2fa: false, authenticators: [], canReset2fa: true}),
    });

    const has2fa = TestStubs.Member({
      ...fields,
      id: '6',
      user: TestStubs.User({
        has2fa: true,
        authenticators: [
          TestStubs.Authenticators().Totp(),
          TestStubs.Authenticators().Sms(),
          TestStubs.Authenticators().U2f(),
        ],
        canReset2fa: true,
      }),
    });

    const multipleOrgs = TestStubs.Member({
      ...fields,
      id: '7',
      user: TestStubs.User({
        has2fa: true,
        authenticators: [TestStubs.Authenticators().Totp()],
        canReset2fa: false,
      }),
    });

    beforeEach(function () {
      organization = TestStubs.Organization({teams});
      routerContext = TestStubs.routerContext([{organization}]);

      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${pendingMember.id}/`,
        body: pendingMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${noAccess.id}/`,
        body: noAccess,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${no2fa.id}/`,
        body: no2fa,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${has2fa.id}/`,
        body: has2fa,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${multipleOrgs.id}/`,
        body: multipleOrgs,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    const button = () =>
      screen.queryByRole('button', {name: 'Reset two-factor authentication'});
    const tooltip = () => screen.queryByTestId('reset-2fa-tooltip');

    const expectButtonEnabled = () => {
      expect(button()).toHaveTextContent('Reset two-factor authentication');
      expect(button()).toBeEnabled();

      expect(tooltip()).not.toBeInTheDocument();
    };

    const expectButtonDisabled = async title => {
      expect(button()).toHaveTextContent('Reset two-factor authentication');
      expect(button()).toBeDisabled();

      userEvent.hover(button());
      expect(await screen.findByText(title)).toBeInTheDocument();
    };

    it('does not show for pending member', function () {
      render(<OrganizationMemberDetail params={{memberId: pendingMember.id}} />, {
        context: routerContext,
      });
      expect(button()).not.toBeInTheDocument();
    });

    it('shows tooltip for joined member without permission to edit', async function () {
      render(<OrganizationMemberDetail params={{memberId: noAccess.id}} />, {
        context: routerContext,
      });
      await expectButtonDisabled('You do not have permission to perform this action');
    });

    it('shows tooltip for member without 2fa', async function () {
      render(<OrganizationMemberDetail params={{memberId: no2fa.id}} />, {
        context: routerContext,
      });
      await expectButtonDisabled('Not enrolled in two-factor authentication');
    });

    it('can reset member 2FA', function () {
      const deleteMocks = has2fa.user.authenticators.map(auth =>
        MockApiClient.addMockResponse({
          url: `/users/${has2fa.user.id}/authenticators/${auth.id}/`,
          method: 'DELETE',
        })
      );

      render(<OrganizationMemberDetail params={{memberId: has2fa.id}} />, {
        context: routerContext,
      });
      renderGlobalModal();

      expectButtonEnabled();
      userEvent.click(button());

      userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      deleteMocks.forEach(deleteMock => {
        expect(deleteMock).toHaveBeenCalled();
      });
    });

    it('shows tooltip for member in multiple orgs', async function () {
      render(<OrganizationMemberDetail params={{memberId: multipleOrgs.id}} />, {
        context: routerContext,
      });
      await expectButtonDisabled(
        'Cannot be reset since user is in more than one organization'
      );
    });

    it('shows tooltip for member in 2FA required org', async function () {
      organization.require2FA = true;
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${has2fa.id}/`,
        body: has2fa,
      });

      render(<OrganizationMemberDetail params={{memberId: has2fa.id}} />, {
        context: routerContext,
      });
      await expectButtonDisabled(
        'Cannot be reset since two-factor is required for this organization'
      );
    });
  });
});
