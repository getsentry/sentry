import selectEvent from 'react-select-event';
import {UserEnrolledAuthenticator} from 'sentry-fixture/authenticators';
import {Member as MemberFixture} from 'sentry-fixture/member';
import {Organization} from 'sentry-fixture/organization';
import {OrgRoleList} from 'sentry-fixture/roleList';
import {Team} from 'sentry-fixture/team';
import {User} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
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
  const team = Team();
  const idpTeam = Team({
    id: '3',
    slug: 'idp-member-team',
    name: 'Idp Member Team',
    isMember: true,
    flags: {
      'idp:provisioned': true,
    },
  });
  const managerTeam = Team({id: '5', orgRole: 'manager', slug: 'manager-team'});
  const otherManagerTeam = Team({
    id: '4',
    slug: 'org-role-team',
    name: 'Org Role Team',
    isMember: true,
    orgRole: 'manager',
  });
  const teams = [
    team,
    Team({
      id: '2',
      slug: 'new-team',
      name: 'New Team',
      isMember: false,
    }),
    idpTeam,
    managerTeam,
    otherManagerTeam,
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

  const member = MemberFixture({
    roles: OrgRoleList(),
    dateCreated: new Date().toISOString(),
    ...teamAssignment,
  });
  const pendingMember = MemberFixture({
    id: '2',
    roles: OrgRoleList(),
    dateCreated: new Date().toISOString(),
    ...teamAssignment,
    invite_link: 'http://example.com/i/abc123',
    pending: true,
  });
  const expiredMember = MemberFixture({
    id: '3',
    roles: OrgRoleList(),
    dateCreated: new Date().toISOString(),
    ...teamAssignment,
    invite_link: 'http://example.com/i/abc123',
    pending: true,
    expired: true,
  });
  const idpTeamMember = MemberFixture({
    id: '4',
    roles: OrgRoleList(),
    dateCreated: new Date().toISOString(),
    teams: [idpTeam.slug],
    teamRoles: [
      {
        teamSlug: idpTeam.slug,
        role: null,
      },
    ],
  });
  const managerTeamMember = MemberFixture({
    id: '5',
    roles: OrgRoleList(),
    dateCreated: new Date().toISOString(),
    teams: [otherManagerTeam.slug],
    teamRoles: [
      {
        teamSlug: otherManagerTeam.slug,
        role: null,
      },
    ],
  });
  const managerMember = MemberFixture({
    id: '6',
    roles: OrgRoleList(),
    role: 'manager',
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    TeamStore.loadInitialData(teams);
  });

  describe('Can Edit', function () {
    const organization = Organization({teams, features: ['team-roles']});

    beforeEach(function () {
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
        url: `/organizations/${organization.slug}/members/${managerTeamMember.id}/`,
        body: managerTeamMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${managerMember.id}/`,
        body: managerMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    it('changes org role to owner', async function () {
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail {...routerProps} params={{memberId: member.id}} />,
        {
          context: routerContext,
        }
      );

      // Should have 4 roles
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(4);

      // Click last radio
      await userEvent.click(radios.at(-1) as Element);
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
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail {...routerProps} params={{memberId: member.id}} />,
        {
          context: routerContext,
        }
      );

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
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail
          {...routerProps}
          params={{memberId: idpTeamMember.id}}
        />,
        {
          context: routerContext,
        }
      );

      expect(screen.getByRole('button', {name: 'Remove'})).toBeDisabled();
    });

    it('cannot leave org role team if missing org:admin', function () {
      const {routerContext, routerProps} = initializeOrg({
        organization: Organization({
          teams,
          features: ['team-roles'],
          access: [],
        }),
      });

      render(
        <OrganizationMemberDetail
          {...routerProps}
          params={{memberId: managerTeamMember.id}}
        />,
        {
          context: routerContext,
        }
      );
      expect(screen.getByText('Manager Team')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Remove'})).toBeDisabled();
    });

    it('cannot join org role team if missing org:admin', async function () {
      const {routerContext, routerProps} = initializeOrg({
        organization: Organization({
          teams,
          features: ['team-roles'],
          access: ['org:write'],
        }),
      });
      render(
        <OrganizationMemberDetail
          {...routerProps}
          params={{memberId: managerMember.id}}
        />,
        {
          context: routerContext,
        }
      );

      await userEvent.click(screen.getByText('Add Team'));
      await userEvent.hover(screen.getByText('#org-role-team'));
      expect(
        await screen.findByText(
          'Membership to a team with an organization role is managed by org owners.'
        )
      ).toBeInTheDocument();
    });

    it('joins a team and assign a team-role', async function () {
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail {...routerProps} params={{memberId: member.id}} />,
        {
          context: routerContext,
        }
      );

      // Should have one team enabled
      expect(screen.getByTestId('team-row-for-member')).toBeInTheDocument();

      // Select new team to join
      // Open the dropdown
      await userEvent.click(screen.getByText('Add Team'));
      // Click the first item
      await userEvent.click(screen.getByText('#new-team'));

      // Assign as admin to new team
      const teamRoleSelect = screen.getAllByText('Contributor')[0];
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
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail {...routerProps} params={{memberId: member.id}} />,
        {
          context: routerContext,
        }
      );

      await userEvent.click(screen.getByText('Add Team'));
      await userEvent.hover(screen.getByText('#idp-member-team'));
      expect(
        await screen.findByText(
          "Membership to this team is managed through your organization's identity provider."
        )
      ).toBeInTheDocument();
    });
  });

  describe('Cannot Edit', function () {
    const organization = Organization({teams, access: ['org:read']});

    beforeEach(function () {
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
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail {...routerProps} params={{memberId: member.id}} />,
        {
          context: routerContext,
        }
      );

      // Should have 4 roles
      const radios = screen.getAllByRole('radio');
      expect(radios.at(0)).toHaveAttribute('readonly');

      // Save Member
      expect(screen.getByRole('button', {name: 'Save Member'})).toBeDisabled();
    });
  });

  describe('Display status', function () {
    const organization = Organization({teams, access: ['org:read']});

    beforeEach(function () {
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
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail
          {...routerProps}
          params={{memberId: pendingMember.id}}
        />,
        {
          context: routerContext,
        }
      );

      expect(screen.getByTestId('member-status')).toHaveTextContent('Invitation Pending');
    });

    it('display expired status', function () {
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail
          {...routerProps}
          params={{memberId: expiredMember.id}}
        />,
        {
          context: routerContext,
        }
      );

      expect(screen.getByTestId('member-status')).toHaveTextContent('Invitation Expired');
    });
  });

  describe('Show resend button', function () {
    const organization = Organization({teams, access: ['org:read']});

    beforeEach(function () {
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
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail
          {...routerProps}
          params={{memberId: pendingMember.id}}
        />,
        {
          context: routerContext,
        }
      );

      expect(screen.getByRole('button', {name: 'Resend Invite'})).toBeInTheDocument();
    });

    it('does not show for expired', function () {
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail
          {...routerProps}
          params={{memberId: expiredMember.id}}
        />,
        {
          context: routerContext,
        }
      );

      expect(
        screen.queryByRole('button', {name: 'Resend Invite'})
      ).not.toBeInTheDocument();
    });
  });

  describe('Reset member 2FA', function () {
    const fields = {
      roles: OrgRoleList(),
      dateCreated: new Date().toISOString(),
      ...teamAssignment,
    };

    const noAccess = MemberFixture({
      ...fields,
      id: '4',
      user: User({has2fa: false, authenticators: undefined}),
    });

    const no2fa = MemberFixture({
      ...fields,
      id: '5',
      user: User({has2fa: false, authenticators: [], canReset2fa: true}),
    });

    const has2fa = MemberFixture({
      ...fields,
      id: '6',
      user: User({
        has2fa: true,
        authenticators: [
          UserEnrolledAuthenticator({type: 'totp', id: 'totp'}),
          UserEnrolledAuthenticator({type: 'sms', id: 'sms'}),
          UserEnrolledAuthenticator({type: 'u2f', id: 'u2f'}),
        ],
        canReset2fa: true,
      }),
    });

    const multipleOrgs = MemberFixture({
      ...fields,
      id: '7',
      user: User({
        has2fa: true,
        authenticators: [UserEnrolledAuthenticator({type: 'totp', id: 'totp'})],
        canReset2fa: false,
      }),
    });

    const organization = Organization({teams});

    beforeEach(function () {
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

      await userEvent.hover(button() as Element);
      expect(await screen.findByText(title)).toBeInTheDocument();
    };

    it('does not show for pending member', function () {
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail
          {...routerProps}
          params={{memberId: pendingMember.id}}
        />,
        {
          context: routerContext,
        }
      );
      expect(button()).not.toBeInTheDocument();
    });

    it('shows tooltip for joined member without permission to edit', async function () {
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail {...routerProps} params={{memberId: noAccess.id}} />,
        {
          context: routerContext,
        }
      );
      await expectButtonDisabled('You do not have permission to perform this action');
    });

    it('shows tooltip for member without 2fa', async function () {
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail {...routerProps} params={{memberId: no2fa.id}} />,
        {
          context: routerContext,
        }
      );
      await expectButtonDisabled('Not enrolled in two-factor authentication');
    });

    it('can reset member 2FA', async function () {
      const {routerContext, routerProps} = initializeOrg({organization});

      const deleteMocks = (has2fa.user?.authenticators || []).map(auth =>
        MockApiClient.addMockResponse({
          url: `/users/${has2fa.user?.id}/authenticators/${auth.id}/`,
          method: 'DELETE',
        })
      );

      render(
        <OrganizationMemberDetail {...routerProps} params={{memberId: has2fa.id}} />,
        {
          context: routerContext,
        }
      );
      renderGlobalModal();

      expectButtonEnabled();
      await userEvent.click(button() as Element);

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      deleteMocks.forEach(deleteMock => {
        expect(deleteMock).toHaveBeenCalled();
      });
    });

    it('shows tooltip for member in multiple orgs', async function () {
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail
          {...routerProps}
          params={{memberId: multipleOrgs.id}}
        />,
        {
          context: routerContext,
        }
      );
      await expectButtonDisabled(
        'Cannot be reset since user is in more than one organization'
      );
    });

    it('shows tooltip for member in 2FA required org', async function () {
      organization.require2FA = true;
      const {routerContext, routerProps} = initializeOrg({organization});
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${has2fa.id}/`,
        body: has2fa,
      });

      render(
        <OrganizationMemberDetail {...routerProps} params={{memberId: has2fa.id}} />,
        {
          context: routerContext,
        }
      );
      await expectButtonDisabled(
        'Cannot be reset since two-factor is required for this organization'
      );
    });
  });

  describe('Org Roles affect Team Roles', () => {
    // Org Admin will be deprecated
    const admin = MemberFixture({
      id: '4',
      role: 'admin',
      roleName: 'Admin',
      orgRole: 'admin',
      ...teamAssignment,
    });
    const manager = MemberFixture({
      id: '5',
      role: 'manager',
      roleName: 'Manager',
      orgRole: 'manager',
      ...teamAssignment,
    });
    const owner = MemberFixture({
      id: '6',
      role: 'owner',
      roleName: 'Owner',
      orgRole: 'owner',
      ...teamAssignment,
    });

    const organization = Organization({teams, features: ['team-roles']});

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
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail {...routerProps} params={{memberId: member.id}} />,
        {
          context: routerContext,
        }
      );

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
      const {routerContext, routerProps} = initializeOrg({organization});

      function testForOrgRole(testMember) {
        cleanup();
        render(
          <OrganizationMemberDetail
            {...routerProps}
            params={{memberId: testMember.id}}
          />,
          {
            context: routerContext,
          }
        );

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
      const {routerContext, routerProps} = initializeOrg({organization});

      render(
        <OrganizationMemberDetail {...routerProps} params={{memberId: member.id}} />,
        {
          context: routerContext,
        }
      );

      // Role info box is hidden
      expect(screen.queryByTestId('alert-role-overwrite')).not.toBeInTheDocument();

      // Dropdown has correct value set
      const teamRow = screen.getByTestId('team-row-for-member');
      const teamRoleSelect = within(teamRow).getByText('Contributor');

      // Change member to owner
      const orgRoleRadio = screen.getAllByRole('radio');
      expect(orgRoleRadio).toHaveLength(4);
      await userEvent.click(orgRoleRadio.at(-1) as Element);
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

    it('overwrites when member joins a manager team', async () => {
      const {routerContext, routerProps} = initializeOrg({});
      render(
        <OrganizationMemberDetail {...routerProps} params={{memberId: member.id}} />,
        {
          context: routerContext,
        }
      );

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
});
