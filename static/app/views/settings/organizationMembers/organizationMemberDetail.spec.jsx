import selectEvent from 'react-select-event';

import {
  cleanup,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
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
  const idpTeam = TestStubs.Team({
    id: '4',
    slug: 'idp-member-team',
    name: 'Idp Member Team',
    isMember: true,
    flags: {
      'idp:provisioned': true,
    },
  });
  const managerTeam = TestStubs.Team({id: '5', orgRole: 'manager', slug: 'manager-team'});
  const teams = [
    team,
    TestStubs.Team({
      id: '2',
      slug: 'new-team',
      name: 'New Team',
      isMember: false,
    }),
    TestStubs.Team({
      id: '3',
      slug: 'idp-team',
      name: 'Idp Team',
      isMember: false,
      flags: {
        'idp:provisioned': true,
      },
    }),
    idpTeam,
    managerTeam,
  ];

  const teamAssignment = {
    teams: [team.slug],
    teamRoles: [
      {
        teamSlug: team.slug,
        role: null,
      },
    ],
  };

  const member = TestStubs.Member({
    roles: TestStubs.OrgRoleList(),
    dateCreated: new Date(),
    ...teamAssignment,
  });
  const pendingMember = TestStubs.Member({
    id: 2,
    roles: TestStubs.OrgRoleList(),
    dateCreated: new Date(),
    ...teamAssignment,
    invite_link: 'http://example.com/i/abc123',
    pending: true,
  });
  const expiredMember = TestStubs.Member({
    id: 3,
    roles: TestStubs.OrgRoleList(),
    dateCreated: new Date(),
    ...teamAssignment,
    invite_link: 'http://example.com/i/abc123',
    pending: true,
    expired: true,
  });
  const idpTeamMember = TestStubs.Member({
    id: 4,
    roles: TestStubs.OrgRoleList(),
    dateCreated: new Date(),
    teams: [idpTeam.slug],
    teamRoles: [
      {
        teamSlug: idpTeam.slug,
        role: null,
      },
    ],
  });

  beforeAll(() => {
    TeamStore.loadInitialData(teams);
  });

  describe('Can Edit', function () {
    beforeEach(function () {
      organization = TestStubs.Organization({teams, features: ['team-roles']});
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
        url: `/organizations/${organization.slug}/members/${idpTeamMember.id}/`,
        body: idpTeamMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    it('changes org role to owner', async function () {
      render(<OrganizationMemberDetail params={{memberId: member.id}} />, {
        context: routerContext,
      });

      // Should have 4 roles
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(4);

      // Click last radio
      await userEvent.click(radios.at(-1));
      expect(radios.at(-1)).toBeChecked();

      // Save Member
      await userEvent.click(screen.getByRole('button', {name: 'Save Member'}));

      expect(updateMember).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            orgRole: 'owner',
          }),
        })
      );
    });

    it('leaves a team', async function () {
      render(<OrganizationMemberDetail params={{memberId: member.id}} />, {
        context: routerContext,
      });

      // Remove our one team
      await userEvent.click(screen.getByRole('button', {name: 'Remove'}));

      // Save Member
      await userEvent.click(screen.getByRole('button', {name: 'Save Member'}));

      expect(updateMember).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            teamRoles: [],
          }),
        })
      );
    });

    it('cannot leave idp-provisioned team', function () {
      render(<OrganizationMemberDetail params={{memberId: idpTeamMember.id}} />, {
        context: routerContext,
      });

      expect(screen.getByRole('button', {name: 'Remove'})).toBeDisabled();
    });

    it('joins a team and assign a team-role', async function () {
      render(<OrganizationMemberDetail params={{memberId: member.id}} />, {
        context: routerContext,
      });

      // Should have one team enabled
      expect(screen.getByTestId('team-row-for-member')).toBeInTheDocument();

      // Select new team to join
      // Open the dropdown
      await userEvent.click(screen.getByText('Add Team'));
      // Click the first item
      await userEvent.click(screen.getByText('#new-team'));

      // Assign as admin to new team
      const teamRoleSelect = screen.getAllByText('Contributor')[1];
      await selectEvent.select(teamRoleSelect, ['Team Admin']);

      // Save Member
      await userEvent.click(screen.getByRole('button', {name: 'Save Member'}));

      expect(updateMember).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            teamRoles: [
              {teamSlug: 'team-slug', role: null},
              {teamSlug: 'new-team', role: 'admin'},
            ],
          }),
        })
      );
    });

    it('cannot join idp-provisioned team', async function () {
      render(<OrganizationMemberDetail params={{memberId: member.id}} />, {
        context: routerContext,
      });

      await userEvent.click(screen.getByText('Add Team'));
      await userEvent.hover(screen.queryByText('#idp-team'));
      expect(
        await screen.findByText(
          "Membership to this team is managed through your organization's identity provider."
        )
      ).toBeInTheDocument();
    });

    it('cannot change roles if member is idp-provisioned', function () {
      const roleRestrictedMember = TestStubs.Member({
        roles: TestStubs.OrgRoleList(),
        dateCreated: new Date(),
        teams: [team.slug],
        flags: {
          'idp:role-restricted': true,
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${member.id}/`,
        body: roleRestrictedMember,
      });
      render(<OrganizationMemberDetail params={{memberId: roleRestrictedMember.id}} />, {
        context: routerContext,
      });

      const radios = screen.getAllByRole('radio');
      expect(radios.at(0)).toHaveAttribute('readonly');
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
      ...teamAssignment,
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

      await userEvent.hover(button());
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

    it('can reset member 2FA', async function () {
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
      await userEvent.click(button());

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

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

  describe('Org Roles affect Team Roles', () => {
    // Org Admin will be deprecated
    const admin = TestStubs.Member({
      id: '4',
      role: 'admin',
      roleName: 'Admin',
      orgRole: 'admin',
      ...teamAssignment,
    });
    const manager = TestStubs.Member({
      id: '5',
      role: 'manager',
      roleName: 'Manager',
      orgRole: 'manager',
      ...teamAssignment,
    });
    const owner = TestStubs.Member({
      id: '6',
      role: 'owner',
      roleName: 'Owner',
      orgRole: 'owner',
      ...teamAssignment,
    });

    beforeAll(() => {
      organization = TestStubs.Organization({teams, features: ['team-roles']});
      routerContext = TestStubs.routerContext([{organization}]);
    });

    beforeEach(() => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${member.id}/`,
        body: member,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${admin.id}/`,
        body: admin,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${manager.id}/`,
        body: manager,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${owner.id}/`,
        body: owner,
      });
    });

    it('does not overwrite team-roles for org members', async () => {
      render(<OrganizationMemberDetail params={{memberId: member.id}} />, {
        context: routerContext,
      });

      // Role info box is hidden
      expect(screen.queryByTestId('alert-role-overwrite')).not.toBeInTheDocument();

      // Dropdown has correct value set
      const teamRow = screen.getByTestId('team-row-for-member');
      const teamRoleSelect = within(teamRow).getByText('Contributor');

      // Dropdown options are not visible
      expect(screen.queryAllByText('...').length).toBe(0);

      // Dropdown can be opened
      selectEvent.openMenu(teamRoleSelect);
      expect(screen.queryAllByText('...').length).toBe(2);

      // Dropdown value can be changed
      await selectEvent.select(teamRoleSelect, ['Team Admin']);
      expect(teamRoleSelect).toHaveTextContent('Team Admin');
    });

    it('overwrite team-roles for org admin/manager/owner', () => {
      function testForOrgRole(testMember) {
        cleanup();
        render(<OrganizationMemberDetail params={{memberId: testMember.id}} />, {
          context: routerContext,
        });

        // Role info box is showed
        expect(screen.queryByTestId('alert-role-overwrite')).toBeInTheDocument();

        // Dropdown has correct value set
        const teamRow = screen.getByTestId('team-row-for-member');
        const teamRoleSelect = within(teamRow).getByText('Team Admin');

        // Dropdown options are not visible
        expect(screen.queryAllByText('...').length).toBe(0);

        // Dropdown cannot be opened
        selectEvent.openMenu(teamRoleSelect);
        expect(screen.queryAllByText('...').length).toBe(0);
      }

      for (const role of [admin, manager, owner]) {
        testForOrgRole(role);
      }
    });

    it('overwrites when changing from member to manager', async () => {
      render(<OrganizationMemberDetail params={{memberId: member.id}} />, {
        context: routerContext,
      });

      // Role info box is hidden
      expect(screen.queryByTestId('alert-role-overwrite')).not.toBeInTheDocument();

      // Dropdown has correct value set
      const teamRow = screen.getByTestId('team-row-for-member');
      const teamRoleSelect = within(teamRow).getByText('Contributor');

      // Change member to owner
      const orgRoleRadio = screen.getAllByRole('radio');
      expect(orgRoleRadio).toHaveLength(4);
      await userEvent.click(orgRoleRadio.at(-1));
      expect(orgRoleRadio.at(-1)).toBeChecked();

      // Role info box is shown
      expect(screen.queryByTestId('alert-role-overwrite')).toBeInTheDocument();

      // Dropdown has correct value set
      within(teamRow).getByText('Team Admin');

      // Dropdown options are not visible
      expect(screen.queryAllByText('...').length).toBe(0);

      // Dropdown cannot be opened
      selectEvent.openMenu(teamRoleSelect);
      expect(screen.queryAllByText('...').length).toBe(0);
    });
  });

  it('overwrites when member joins a manager team', async () => {
    render(<OrganizationMemberDetail params={{memberId: member.id}} />, {
      context: routerContext,
    });

    // Role info box is hidden
    expect(screen.queryByTestId('alert-role-overwrite')).not.toBeInTheDocument();

    // Dropdown has correct value set
    const teamRow = screen.getByTestId('team-row-for-member');
    const teamRoleSelect = within(teamRow).getByText('Contributor');

    // Join manager team
    await userEvent.click(screen.getByText('Add Team'));
    // Click the first item
    await userEvent.click(screen.getByText('#manager-team'));

    // Role info box is shown
    expect(screen.queryByTestId('alert-role-overwrite')).toBeInTheDocument();

    // Dropdowns have correct value set
    const teamRows = screen.getAllByTestId('team-row-for-member');
    within(teamRows[0]).getByText('Team Admin');
    within(teamRows[1]).getByText('Team Admin');

    // Dropdown options are not visible
    expect(screen.queryAllByText('...').length).toBe(0);

    // Dropdown cannot be opened
    selectEvent.openMenu(teamRoleSelect);
    expect(screen.queryAllByText('...').length).toBe(0);
  });
});
